// Requires AI_GATEWAY_API_KEY in .env (Bun loads it automatically).
import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate } from "ai";

const INTERACTIVE = /^(link|button|textbox|checkbox|combobox|menuitem(radio|checkbox)?|tab|option)$/;

export function choicesFromTree(tree: string): Record<string, string> {
  return Object.fromEntries(
    [...tree.matchAll(/^\s*- (\w+) "([^"]*)".*\[ref=(\w+)\]/gm)]
      .filter(([, role]) => INTERACTIVE.test(role!))
      .map(([, role, label, ref]) => [ref, `${role} "${label}"`]),
  );
}

// history: clicks so far, so the agent knows the steps are already done and answers "done" instead of looping.
export async function nextClick(goal: string, tree: string, history: string[] = []) {
  const choices = choicesFromTree(tree);
  const { answers } = await experimental_evaluate({
    model: gateway.evaluationModel(process.env.JEV_MODEL!),
    state: `Goal: ${goal}\n\nClicks made so far, in order: ${history.length ? history.join(" → ") : "none yet"}\n\nCurrent page (accessibility tree):\n${tree}`,
    questions: {
      next: {
        type: "choice",
        instructions: "Which element should be clicked next to reach the goal? Answer done if the page already shows the goal reached, or if the clicks made so far already completed the steps. Never repeat a sequence that has already been performed.",
        criteria: { done: "the goal is already reached, stop", ...choices },
      },
    },
  });
  const ref = (answers.next as { choice: string }).choice;
  return { ref, label: choices[ref] ?? ref };
}

if (import.meta.main) {
  const result = await experimental_evaluate({
    model: gateway.evaluationModel(process.env.JEV_MODEL!),
    state: "The GIF renders correctly but the accessibility tree ref is stale after navigation.",
    questions: {
      isBug: {
        type: "boolean",
        instructions: "Does this describe a real bug that needs fixing?",
      },
      severity: {
        type: "choice",
        instructions: "How severe is this issue?",
        criteria: {
          low: "Cosmetic or rare edge case",
          medium: "Affects some runs but has a workaround",
          high: "Breaks the core flow",
        },
      },
    },
  });

  console.log(JSON.stringify(result.answers, null, 2));
}
