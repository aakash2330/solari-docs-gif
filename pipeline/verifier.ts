import { readFile } from "node:fs/promises";
import { z } from "zod";
import { answer } from "./model.ts";

const Verdict = z.object({
  ok: z.boolean().describe("true if the screen shows the end state"),
  reason: z.string().describe("one short reason"),
});

// Asks the model whether the final frame shows the goal. Returns the reason so a retry can learn from it.
export async function verify(goal: string, png: string) {
  return answer(Verdict, [
    {
      role: "user",
      content: [
        { type: "file", mediaType: "image/png", data: await readFile(png) },
        { type: "text", text: `This is the final screen of a recording, a single frame. Does it show this end state? "${goal}"` },
      ],
    },
  ]);
}
