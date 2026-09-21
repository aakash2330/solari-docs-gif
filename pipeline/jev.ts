// Simple demo call to TypeSafe AI's Jev evaluation model via the Vercel AI Gateway.
// Requires AI_GATEWAY_API_KEY in .env (Bun loads it automatically).
import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate } from "ai";

const INTERACTIVE = /^(link|button|textbox|checkbox|combobox|menuitem|tab|option)$/;

/** Interactive nodes of the tree, ref → label, as Jev's choice criteria. */
export function choicesFromTree(tree: string): Record<string, string> {
  return Object.fromEntries(
    [...tree.matchAll(/^\s*- (\w+) "([^"]*)".*\[ref=(\w+)\]/gm)]
      .filter(([, role]) => INTERACTIVE.test(role!))
      .map(([, role, label, ref]) => [ref, `${role} "${label}"`]),
  );
}

/** Which element to click next toward the goal, or "done" once the tree shows it reached. */
export async function nextClick(goal: string, tree: string) {
  const { answers } = await experimental_evaluate({
    model: gateway.evaluationModel("typesafe-ai/jev"),
    state: `Goal: ${goal}\n\nCurrent page (accessibility tree):\n${tree}`,
    questions: {
      next: {
        type: "choice",
        instructions: "Which element should be clicked next to reach the goal? Answer done if the page already shows the goal reached.",
        criteria: { done: "the goal is already reached, stop", ...choicesFromTree(tree) },
      },
    },
  });
  return (answers.next as { choice: string }).choice;
}

if (import.meta.main) {
  const result = await experimental_evaluate({
    model: gateway.evaluationModel("typesafe-ai/jev"),
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
