import { execSync } from "node:child_process";
import { pipeline } from "./index.ts";

const dir = process.argv[2] ?? "docs/docs/how-to";
const changed = execSync("git diff --name-only HEAD; git ls-files --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.startsWith(dir + "/") && f.endsWith(".md"))
  .sort();
if (!changed.length) {
  console.error(`nothing changed in ${dir} since the last commit`);
  process.exit(0);
}
await pipeline("update", changed);
