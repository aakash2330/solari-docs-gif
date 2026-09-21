import { openBrowser } from "./browser";
import { CURSOR, toGif, type Frame } from "./gif";
import { nextClick } from "./jev";
import { plan, replan, type Goal } from "./planner";
import { verify } from "./verifier";

const DOC_URL = process.argv[2] ?? "http://localhost:3001/how-to/filtering-tasks";
const HEADLESS = true;

type Run = {
  source: string;
  browser?: Awaited<ReturnType<typeof openBrowser>>;
  page?: { title: string; sections: { heading: string; anchor: string; text: string }[] };
  goals?: Goal[];
  cursor?: Uint8Array;
};

const MAX_STEPS = 10;

const steps: [string, (run: Run) => Promise<void>][] = [
  [
    "open browser",
    async (run) => {
      run.browser = await openBrowser({ headless: HEADLESS });
      await run.browser.navigate(run.source);
    },
  ],
  [
    "read page",
    async (run) => {
      run.page = await run.browser!.sections();
      console.error(`  ${run.page.sections.length} sections`);
    },
  ],
  [
    "plan goals",
    async (run) => {
      run.goals = await plan({ source: run.source, ...run.page! });
      console.error(`${run.goals.length} worth recording`);
    },
  ],
  [
    "record",
    async (run) => {
      run.cursor = await run.browser!.rasterize(CURSOR.svg, CURSOR.w, CURSOR.h);
      for (const g of run.goals!) await record(run, g);
    },
  ],
  [
    "verify",
    async (run) => {
      for (const g of run.goals!) await check(g);
    },
  ],
  [
    "retry failed",
    async (run) => {
      const failed = run.goals!.filter((g) => !g.verified);
      if (!failed.length) return;
      // ponytail: one batched retry; loop it if a second pass ever pays off.
      await replan({ source: run.source, ...run.page! }, run.goals!);
      for (const g of failed) {
        console.error(`  ${g.title}: ${g.instruction}`);
        await record(run, g);
        await check(g);
      }
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

// out/<page-slug>[-<anchor>], so runs over several pages do not overwrite each other.
const out = (g: Goal) => `out/${g.url.replace(/^.*\//, "").replace("#", "-")}`;

async function record(run: Run, g: Goal) {
  const b = run.browser!;
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
  g.gif = `${out(g)}.gif`;
  await Bun.write(g.gif, toGif(frames, run.cursor));
  await Bun.write(`${out(g)}.png`, frames.at(-1)!.png);
}

async function check(g: Goal) {
  // ponytail: last frame only; add more frames if bad GIFs slip through.
  const png = `${out(g)}.png`;
  const { ok, reason } = await verify(g.goal, png);
  await Bun.file(png).delete();
  g.verified = ok;
  g.reason = reason;
  console.error(`  ${g.title}: ${ok ? "yes" : "no"} ${reason}`);
}

const run: Run = { source: DOC_URL };
try {
  for (const [name, step] of steps) {
    const t = Date.now();
    console.error(`→ ${name}`);
    await step(run);
    console.error(`  done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
} finally {
  await run.browser?.close();
}

console.log(
  JSON.stringify(
    { source: run.source, generated_at: new Date().toISOString(), goals: run.goals },
    null,
    2,
  ),
);
