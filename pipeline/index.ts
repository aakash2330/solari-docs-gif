import type { FileSink } from "bun";
import { renameSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import { openBrowser } from "./browser";
import { CURSOR, toGif, type Frame } from "./gif";
import { MAX_STEPS, nextClick } from "./jev";
import { plan, replan, type Goal, type Page } from "./planner";
import { verify } from "./verifier";

const DOCS = "docs/docs";
const IMG = "docs/static/img";
const HEADLESS = true;
// out/<run>/<page>/<section>.gif, kept forever as the record of every run.
const RUN = `out/${new Date().toISOString().slice(0, 16).replace(/:/g, "-")}`;
let logFile: FileSink;
function log(line: string) {
  console.error(line);
  logFile.write(line + "\n");
  logFile.flush();
}

type Browser = Awaited<ReturnType<typeof openBrowser>>;
type Run = Page & { browser: Browser; cursor: Uint8Array; goals?: Goal[] };

const steps: [string, (run: Run) => Promise<void>][] = [
  [
    "plan goals",
    async (run) => {
      run.goals = await plan(run);
      log(`  ${run.goals.length} worth recording`);
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
      // one batched retry; loop it if a second pass ever pays off.
      await replan(run, run.goals!);
      for (const g of failed) {
        log(`  ${g.title}: ${g.instruction}`);
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
        const embed = `![${g.title}](/img/${rel}/${key(run, g)})`;
        // A re-run overwrites the GIF in place; the embed only goes in once.
        await Bun.write(`${IMG}/${rel}/${key(run, g)}`, Bun.file(g.gif));
        if (lines.includes(embed)) continue;
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
        log(`  ${g.verified ? "✓" : "✗"} ${g.title}${g.instruction ? " (retried)" : ""} → ${g.gif}`);
      log(`  ${goals.filter((g) => g.verified).length}/${goals.length} verified`);
    },
  ],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// <page>/<section>.gif, the same relative path in out/<run>/ and in the docs image folder.
const key = (run: Run, g: Goal) => `${basename(run.file, ".md")}/${slug(g.title)}.gif`;
const out = (run: Run, g: Goal) => `${RUN}/${key(run, g)}`;

async function record(run: Run, g: Goal) {
  const b = run.browser;
  await b.navigate(process.env.APP_URL ?? "http://localhost:3000");
  const frames: Frame[] = [];
  g.trace = [];
  let i = 0;
  // click-only loop, add type() when a goal needs text input
  for (; i < MAX_STEPS; i++) {
    const { ref, label } = await nextClick(g.instruction || g.goal, await b.tree(), g.trace);
    log(`  ${g.title}: ${label}`);
    if (ref === "done") break;
    g.trace.push(label);
    frames.push({ png: await b.screenshot(), at: await b.center(ref) });
    await b.click(ref);
    await b.page.waitForTimeout(400);
  }
  g.trace.push(i < MAX_STEPS ? "done" : "hit step cap");
  frames.push({ png: await b.screenshot() });
  g.gif = out(run, g);
  await Bun.write(g.gif, toGif(frames, run.cursor));
  await Bun.write(`${g.gif}.png`, frames.at(-1)!.png);
}

async function check(run: Run, g: Goal) {
  // last frame only; add more frames if bad GIFs slip through.
  const png = `${g.gif}.png`;
  const { ok, reason } = await verify(g.goal, png);
  await Bun.file(png).delete();
  g.verified = ok;
  g.reason = reason;
  log(`  ${g.title}: ${ok ? "yes" : "no"} ${reason}`);
  // A failed attempt keeps its GIF under a .failed name; a retry writes a fresh one beside it.
  if (!ok) renameSync(g.gif, (g.gif = g.gif.replace(/\.gif$/, ".failed.gif")));
}

export async function pipeline(mode: "generate" | "update", files: string[]) {
  await Bun.write(`${RUN}/log.txt`, "");
  logFile = Bun.file(`${RUN}/log.txt`).writer();
  log(`${mode}: ${files.length} page(s)`);
  for (const f of files) log(`  ${f}`);
  const browser = await openBrowser({ headless: HEADLESS });
  const cursor = await browser.rasterize(CURSOR.svg, CURSOR.w, CURSOR.h);
  try {
    for (const file of files) {
      log(`\n# ${file}`);
      const run: Run = { file, text: await Bun.file(file).text(), browser, cursor };
      for (const [name, step] of steps) {
        const t = Date.now();
        log(`→ ${name}`);
        await step(run);
        log(`  done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
      }
    }
  } finally {
    await browser.close();
    logFile.end();
  }
}
