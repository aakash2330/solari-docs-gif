// The pipeline, one step at a time. Record, assert, stitch and embed drop in here.
import { openBrowser } from "./browser";
import { plan } from "./planner";

// The demo app's own docs page, once it exists.
const DOC_URL = "https://support.google.com/chrome/answer/95464";
const HEADLESS = true;

type Run = {
  source: string;
  browser?: Awaited<ReturnType<typeof openBrowser>>;
  page?: { title: string; sections: { heading: string; anchor: string; text: string }[] };
  goals?: Awaited<ReturnType<typeof plan>>;
};

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
      console.error(`  ${run.goals.length} worth recording`);
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
