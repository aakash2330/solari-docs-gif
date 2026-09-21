import { z } from "zod";

const Goals = z.object({
  goals: z.array(
    z.object({
      title: z.string().describe("the section heading this is for, copied exactly"),
      goal: z.string().describe("the end state to reach, in one sentence"),
      instruction: z.string().describe("how the browser agent gets there: what to click, in order, and what to avoid. Empty string unless asked for one."),
    }),
  ),
});
// The CLI's ajv rejects zod's $schema ref.
const { $schema, ...jsonSchema } = z.toJSONSchema(Goals);
const SCHEMA = JSON.stringify(jsonSchema);

export type Goal = z.infer<typeof Goals>["goals"][number] & {
  url: string;
  gif: string;
  trace: string[];
  verified: boolean;
  reason: string;
};
type Page = { source: string; title: string; sections: { heading: string; anchor: string; text: string }[] };

const SYSTEM = `You plan screen recordings for a help page. Return one goal per section that documents a concrete UI task worth a GIF, and nothing for sections that are conceptual, reference, pricing or installation.
A goal is the end state a viewer should reach, in one sentence, visible on screen ("a database named Tasks appears in the sidebar"). Never list clicks or name menus — the agent driving the browser works that out from the live page.`;

async function ask(prompt: string) {
  // No --max-turns: structured output arrives as a tool call, which spends a turn.
  const out = await Bun.$`claude -p --model ${process.env.CLAUDE_MODEL!} --effort medium --output-format json --json-schema ${SCHEMA} < ${Buffer.from(prompt)}`
    .quiet()
    .json();
  if (out.is_error) throw new Error(`claude cli: ${out.result}`);
  return Goals.parse(JSON.parse(out.result)).goals;
}

const pageBody = (page: Page) =>
  page.sections
    // ponytail: flat truncation, swap for a real token budget if pages get long
    .map((s) => `## ${s.heading}\n${s.text.slice(0, 2000)}`)
    .join("\n\n");

export async function plan(page: Page): Promise<Goal[]> {
  const goals = await ask(`${SYSTEM}\n\nPage: ${page.title}\nURL: ${page.source}\n\n${pageBody(page)}`);

  return goals.map((g) => {
    const anchor = page.sections.find((s) => s.heading === g.title)?.anchor;
    return {
      ...g,
      instruction: "",
      url: anchor ? `${page.source.split("#")[0]}#${anchor}` : page.source,
      gif: "",
      trace: [],
      verified: false,
      reason: "",
    };
  });
}

const REPLAN = `A browser agent tried to reach each goal below by clicking through the live app, and a checker judged the final screenshot. Some FAILED. Return only the FAILED goals, title and goal copied exactly, with an instruction for the agent: the concrete elements to click in order, and what to avoid, learned from the traces. PASSED goals show what works on this app. A trace ending in "hit step cap" wandered; one ending in "done" stopped too early or on the wrong screen. Sections of the help page follow for context.`;

// Fills g.instruction on the failed goals, in place.
export async function replan(page: Page, goals: Goal[]) {
  const runs = goals
    .map(
      (g) =>
        `## ${g.title} — ${g.verified ? "PASSED" : "FAILED"}\nGoal: ${g.goal}\nClicks: ${g.trace.join(" → ")}\nChecker: ${g.reason}`,
    )
    .join("\n\n");
  const fixes = await ask(`${REPLAN}\n\n# Runs\n\n${runs}\n\n# Help page: ${page.title}\n\n${pageBody(page)}`);
  for (const f of fixes) {
    const g = goals.find((g) => g.title === f.title && !g.verified);
    if (g) g.instruction = f.instruction;
  }
}
