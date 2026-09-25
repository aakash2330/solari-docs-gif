// Records every page in a directory (default docs/docs/how-to).
import { join } from "node:path";
import { pipeline } from "./index";

const dir = process.argv[2] ?? "docs/docs/how-to";
const pages = (await Array.fromAsync(new Bun.Glob("*.md").scan(dir))).sort().map((f) => join(dir, f));
await pipeline("generate", pages);
