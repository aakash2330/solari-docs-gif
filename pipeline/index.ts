import { openBrowser } from "./browser";
import { CURSOR, toGif, type Frame } from "./gif";
import { nextClick } from "./jev";
import { plan } from "./planner";
import { verify } from "./verifier";

const DOC_URL = "http://localhost:3001/how-to/filtering-tasks";
const HEADLESS = true;

type Run = {
  source: string;
  browser?: Awaited<ReturnType<typeof openBrowser>>;
  page?: { title: string; sections: { heading: string; anchor: string; text: string }[] };
  goals?: Awaited<ReturnType<typeof plan>>;
  ends: string[];
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
    "record + verify",
    async (run) => {
      const b = run.browser!;
      const cursor = await b.rasterize(CURSOR.svg, CURSOR.w, CURSOR.h);
      for (const g of run.goals!) {
        const name = `out/${g.url.split("#")[1] || "page"}`;
        g.gif = `${name}.gif`;
        run.ends.push(`${name}.png`);
        let goal = g.goal;
        // ponytail: one retry; make it a loop with a cap if one isn't enough.
        for (let attempt = 0; attempt < 2; attempt++) {
          await record(b, cursor, goal, name);
          const { ok, reason } = await verify(g.goal, `${name}.png`);
          console.error(`  ${g.title}: ${ok ? "yes" : "no"} ${reason}`);
          g.verified = ok;
          if (ok) break;
          goal = `${g.goal}\n\nA previous attempt ended on the wrong screen: ${reason}\nAvoid repeating that.`;
        }
      }
    },
  ],
];

async function record(
  b: NonNullable<Run["browser"]>, cursor: Uint8Array, goal: string, name: string,
) {
  await b.navigate(process.env.APP_URL ?? "http://localhost:3000");
  const frames: Frame[] = [];
  // ponytail: click-only loop, add type() when a goal needs text input
  for (let i = 0; i < MAX_STEPS; i++) {
    const ref = await nextClick(goal, await b.tree());
    console.error(`  ${name}: ${ref}`);
    if (ref === "done") break;
    frames.push({ png: await b.screenshot(), at: await b.center(ref) });
    await b.click(ref);
    await b.page.waitForTimeout(400);
  }
  frames.push({ png: await b.screenshot() });
  await Bun.write(`${name}.gif`, toGif(frames, cursor));
  await Bun.write(`${name}.png`, frames.at(-1)!.png);
}

const run: Run = { source: DOC_URL, ends: [] };
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
