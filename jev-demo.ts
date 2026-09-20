// Simple demo call to TypeSafe AI's Jev evaluation model via the Vercel AI Gateway.
// Requires AI_GATEWAY_API_KEY in .env (Bun loads it automatically).
import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate } from "ai";

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
