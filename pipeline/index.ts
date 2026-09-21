// The pipeline, one step at a time. Record, assert, stitch and embed drop in here.
import { openBrowser } from "./browser";
import { toGif } from "./gif";
import { nextClick } from "./jev";
import { plan } from "./planner";

// The demo app's own docs page, once it exists.
const DOC_URL = "http://localhost:3001/how-to/filtering-tasks";
const HEADLESS = true;

type Run = {
  source: string;
  browser?: Awaited<ReturnType<typeof openBrowser>>;
  page?: { title: string; sections: { heading: string; anchor: string; text: string }[] };
  goals?: Awaited<ReturnType<typeof plan>>;
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
      const b = run.browser!;
      for (const g of run.goals!) {
        await b.navigate(process.env.APP_URL ?? "http://localhost:3000");
        const frames = [await b.screenshot()];
        // ponytail: click-only loop, add type() when a goal needs text input
        for (let i = 0; i < MAX_STEPS; i++) {
          const ref = await nextClick(g.goal, await b.tree());
          console.error(`  ${g.title}: ${ref}`);
          if (ref === "done") break;
          await b.click(ref);
          await b.page.waitForTimeout(400); // let menus finish animating in
          frames.push(await b.screenshot());
        }
        g.gif = `out/${g.url.split("#")[1] || "page"}.gif`;
        await Bun.write(g.gif, toGif(frames));
      }
    },
  ],
];

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
