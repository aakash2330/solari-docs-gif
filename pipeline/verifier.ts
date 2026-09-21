// Asks Claude whether the final frame shows the goal. Returns the reason so a retry can learn from it.
export async function verify(goal: string, png: string) {
  const text = (
    await Bun.$`claude -p --model ${process.env.CLAUDE_MODEL!} --effort medium --max-turns 3 ${
      `Read the image ${png} then answer: does it show the following? "${goal}"
Answer yes or no, then one short reason.`
    }`.quiet().text()
  ).trim();
  return { ok: /^yes/i.test(text), reason: text.replace(/^(yes|no)[.,:\s-]*/i, "") };
}
