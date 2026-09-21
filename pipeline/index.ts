import { basename, dirname, relative } from "node:path";
import { openBrowser } from "./browser";
import { CURSOR, toGif, type Frame } from "./gif";
import { nextClick } from "./jev";
import { plan, replan, type Goal, type Page } from "./planner";
import { verify } from "./verifier";

const DIR = process.argv[2] ?? "docs/docs/how-to";
const DOCS = "docs/docs";
const IMG = "docs/static/img";
const HEADLESS = true;
const MAX_STEPS = 10;

type Browser = Awaited<ReturnType<typeof openBrowser>>;
type Run = Page & { browser: Browser; cursor: Uint8Array; goals?: Goal[] };

const steps: [string, (run: Run) => Promise<void>][] = [
  [
    "plan goals",
    async (run) => {
      run.goals = await plan(run);
      console.error(`  ${run.goals.length} worth recording`);
    },
  ],
  [
    "record",
    async (run) => {
      for (const g of run.goals!) await record(run, g);
    },
  ],
  [
    "verify",
    async (run) => {
      for (const g of run.goals!) await check(run, g);
    },
  ],
  [
    "retry failed",
    async (run) => {
      const failed = run.goals!.filter((g) => !g.verified);
      if (!failed.length) return;
      // ponytail: one batched retry; loop it if a second pass ever pays off.
      await replan(run, run.goals!);
      for (const g of failed) {
        console.error(`  ${g.title}: ${g.instruction}`);
        await record(run, g);
        await check(run, g);
      }
    },
  ],
  [
    "write docs",
    async (run) => {
      const lines = run.text.split("\n");
      const rel = dirname(relative(DOCS, run.file));
      // Bottom-up so earlier line numbers stay valid after each insert.
      for (const g of run.goals!.filter((g) => g.verified).sort((a, b) => b.after_line - a.after_line)) {
        const name = basename(g.gif);
        const embed = `![${g.title}](/img/${rel}/${name})`;
        if (lines.includes(embed)) continue;
        await Bun.write(`${IMG}/${rel}/${name}`, Bun.file(g.gif));
        lines.splice(g.after_line, 0, "", embed);
      }
      await Bun.write(run.file, lines.join("\n"));
    },
  ],
  [
    "summary",
    async (run) => {
      const goals = run.goals!;
      for (const g of goals)
        console.error(`  ${g.verified ? "✓" : "✗"} ${g.title}${g.instruction ? " (retried)" : ""} → ${g.gif}`);
      console.error(`  ${goals.filter((g) => g.verified).length}/${goals.length} verified`);
    },
  ],
];

// out/<file-stem>[-<line>], so several goals in one file do not overwrite each other.
const out = (run: Run, g: Goal) =>
  `out/${basename(run.file, ".md")}${run.goals!.length > 1 ? `-${g.after_line}` : ""}`;

async function record(run: Run, g: Goal) {
  const b = run.browser;
  await b.navigate(process.env.APP_URL ?? "http://localhost:3000");
  const frames: Frame[] = [];
  g.trace = [];
  let i = 0;
  // ponytail: click-only loop, add type() when a goal needs text input
  for (; i < MAX_STEPS; i++) {
    const { ref, label } = await nextClick(g.instruction || g.goal, await b.tree(), g.trace);
    console.error(`  ${g.title}: ${label}`);
    if (ref === "done") break;
    g.trace.push(label);
    frames.push({ png: await b.screenshot(), at: await b.center(ref) });
    await b.click(ref);
    await b.page.waitForTimeout(400);
  }
  g.trace.push(i < MAX_STEPS ? "done" : "hit step cap");
  frames.push({ png: await b.screenshot() });
  g.gif = `${out(run, g)}.gif`;
  await Bun.write(g.gif, toGif(frames, run.cursor));
  await Bun.write(`${out(run, g)}.png`, frames.at(-1)!.png);
}

async function check(run: Run, g: Goal) {
  // ponytail: last frame only; add more frames if bad GIFs slip through.
  const png = `${out(run, g)}.png`;
  const { ok, reason } = await verify(g.goal, png);
  await Bun.file(png).delete();
  g.verified = ok;
  g.reason = reason;
  console.error(`  ${g.title}: ${ok ? "yes" : "no"} ${reason}`);
}

const files = (await Array.fromAsync(new Bun.Glob("*.md").scan(DIR))).sort().map((f) => `${DIR}/${f}`);
const browser = await openBrowser({ headless: HEADLESS });
const cursor = await browser.rasterize(CURSOR.svg, CURSOR.w, CURSOR.h);
const results: { file: string; goals?: Goal[] }[] = [];
try {
  for (const file of files) {
    console.error(`\n# ${file}`);
    const run: Run = { file, text: await Bun.file(file).text(), browser, cursor };
    for (const [name, step] of steps) {
      const t = Date.now();
      console.error(`→ ${name}`);
      await step(run);
      console.error(`  done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    }
    results.push({ file, goals: run.goals });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));
