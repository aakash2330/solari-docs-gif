import { z } from "zod";
import { CAPABILITIES } from "./jev";

const Goals = z.object({
  goals: z.array(
    z.object({
      title: z.string().describe("the section heading this is for, copied exactly"),
      goal: z.string().describe("the end state to reach, in one sentence"),
      after_line: z.number().int().describe("line number the GIF goes after: the last line of the paragraph describing the result of the steps"),
      instruction: z.string().describe("how the browser agent gets there: what to click, in order, and what to avoid. Empty string unless asked for one."),
    }),
  ),
});
// The CLI's ajv rejects zod's $schema ref.
const { $schema, ...jsonSchema } = z.toJSONSchema(Goals);
const SCHEMA = JSON.stringify(jsonSchema);

export type Goal = z.infer<typeof Goals>["goals"][number] & {
  gif: string;
  trace: string[];
  verified: boolean;
  reason: string;
};
export type Page = { file: string; text: string };

const SYSTEM = `You plan screen recordings for a help page written in markdown. Return one goal per section that documents a concrete UI task worth a GIF, and nothing for sections that are conceptual, reference, pricing or installation.
A goal is the end state a viewer should reach, in one sentence, visible on screen ("a database named Tasks appears in the sidebar"). Never list clicks or name menus — the agent driving the browser works that out from the live page.
The goal is the state right after the numbered steps. A closing sentence about reversing the change (reset, undo, bring it back) is not part of the goal.
${CAPABILITIES} Skip sections whose steps need anything else, and never make a goal hinge on a specific example ID or name from the text.
Lines are numbered "N: text". after_line is the number of the last line of the paragraph describing the result of the steps, so the GIF lands right below it.`;

async function ask(prompt: string) {
  // No --max-turns: structured output arrives as a tool call, which spends a turn.
  const out = await Bun.$`claude -p --model ${process.env.CLAUDE_MODEL!} --effort medium --output-format json --json-schema ${SCHEMA} < ${Buffer.from(prompt)}`
    .quiet()
    .json();
  if (out.is_error) throw new Error(`claude cli: ${out.result}`);
  return Goals.parse(JSON.parse(out.result)).goals;
}

const numbered = (page: Page) =>
  page.text
    .split("\n")
    .map((l, i) => `${i + 1}: ${l}`)
    .join("\n");

export async function plan(page: Page): Promise<Goal[]> {
  const goals = await ask(`${SYSTEM}\n\nFile: ${page.file}\n\n${numbered(page)}`);
  return goals.map((g) => ({ ...g, instruction: "", gif: "", trace: [], verified: false, reason: "" }));
}

const REPLAN = `A browser agent tried to reach each goal below by clicking through the live app, and a checker judged the final screenshot. Some FAILED. Return only the FAILED goals, title, goal and after_line copied exactly, with an instruction for the agent: the concrete elements to click in order, and what to avoid, learned from the traces. PASSED goals show what works on this app. A trace ending in "hit step cap" wandered; one ending in "done" stopped too early or on the wrong screen. ${CAPABILITIES} Instructions may only use clicks.
The help page follows for context.`;

// Fills g.instruction on the failed goals, in place.
export async function replan(page: Page, goals: Goal[]) {
  const runs = goals
    .map(
      (g) =>
        `## ${g.title} — ${g.verified ? "PASSED" : "FAILED"}\nGoal: ${g.goal}\nClicks: ${g.trace.join(" → ")}\nChecker: ${g.reason}`,
    )
    .join("\n\n");
  const fixes = await ask(`${REPLAN}\n\n# Runs\n\n${runs}\n\n# Help page: ${page.file}\n\n${numbered(page)}`);
  for (const f of fixes) {
    const g = goals.find((g) => g.title === f.title && !g.verified);
    if (g) g.instruction = f.instruction;
  }
}
