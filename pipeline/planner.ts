// Docs text in, goals out. Decides only — the browser agent works out how to get there.
import { z } from "zod";

const Plan = z.object({
  goals: z.array(
    z.object({
      title: z.string().describe("the section heading this is for, copied exactly"),
      goal: z.string().describe("the end state to reach, in one sentence"),
    }),
  ),
});
// The CLI's ajv rejects zod's $schema ref.
const { $schema, ...jsonSchema } = z.toJSONSchema(Plan);
const SCHEMA = JSON.stringify(jsonSchema);

const SYSTEM = `You plan screen recordings for a help page. Return one goal per section that documents a concrete UI task worth a GIF, and nothing for sections that are conceptual, reference, pricing or installation.
A goal is the end state a viewer should reach, in one sentence, visible on screen ("a database named Tasks appears in the sidebar"). Never list clicks or name menus — the agent driving the browser works that out from the live page.`;

async function ask(prompt: string) {
  // No --max-turns: structured output arrives as a tool call, which spends a turn.
  const out = await Bun.$`claude -p --model claude-opus-5 --effort medium --output-format json --json-schema ${SCHEMA} < ${Buffer.from(prompt)}`
    .quiet()
    .json();
  if (out.is_error) throw new Error(`claude cli: ${out.result}`);
  return Plan.parse(JSON.parse(out.result));
}

export async function plan(page: {
  source: string;
  title: string;
  sections: { heading: string; anchor: string; text: string }[];
}) {
  const body = page.sections
    // ponytail: flat truncation, swap for a real token budget if pages get long
    .map((s) => `## ${s.heading}\n${s.text.slice(0, 2000)}`)
    .join("\n\n");

  const { goals } = await ask(`${SYSTEM}\n\nPage: ${page.title}\nURL: ${page.source}\n\n${body}`);

  return goals.map((g) => {
    const anchor = page.sections.find((s) => s.heading === g.title)?.anchor;
    return {
      title: g.title,
      goal: g.goal,
      url: anchor ? `${page.source.split("#")[0]}#${anchor}` : page.source,
      gif: "",
    };
  });
}
