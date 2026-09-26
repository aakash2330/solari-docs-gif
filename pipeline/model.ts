import { generateText, tool, type ModelMessage } from "ai";
import type { z } from "zod";

// ponytail: one call per 12s keeps us under the free tier's 5 requests a minute; drop it on paid credits.
let last = 0;

// Every answer comes back as a forced tool call, so nothing is ever parsed out of text.
// A plain model id goes through the Vercel AI Gateway, keyed by AI_GATEWAY_API_KEY.
export async function answer<T extends z.ZodType>(schema: T, prompt: string | ModelMessage[]): Promise<z.infer<T>> {
  await Bun.sleep(Math.max(0, last + 12_000 - Date.now()));
  last = Date.now();
  const { staticToolCalls, toolCalls } = await generateText({
    model: "openai/gpt-4.1-mini",
    tools: { answer: tool({ inputSchema: schema }) },
    toolChoice: { type: "tool", toolName: "answer" },
    prompt,
  });
  const call = staticToolCalls[0];
  if (!call) throw new Error(`no valid answer came back: ${JSON.stringify(toolCalls)}`);
  return call.input as z.infer<T>;
}
