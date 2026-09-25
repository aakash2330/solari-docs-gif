import { z } from "zod";
import index from "../app/index.html";

// Tweaks live in a file, not localStorage: the recorder's browser isn't yours.
const Pos = z.enum(["left", "middle", "right"]);
const Tweaks = z.object({
  search: Pos,
  status: Pos,
  priority: Pos,
});
export type Tweaks = z.infer<typeof Tweaks>;
const FILE = Bun.file(import.meta.dir + "/../app/tweaks.json");
const ROOT = import.meta.dir + "/..";
const DOCS = ROOT + "/docs/docs/how-to";

// A tweak rewrites the position phrase after each name in the docs, so git sees the page changed and update.ts re-records it.
const NAMES: Record<keyof Tweaks, string> = { search: "search box", status: "\\*\\*Status\\*\\*", priority: "\\*\\*Priority\\*\\*" };
const PHRASE: Record<Tweaks["search"], string> = { left: "on the left", middle: "in the middle", right: "on the right" };
async function syncDocs(t: Tweaks) {
  for await (const f of new Bun.Glob("*.md").scan(DOCS)) {
    const path = `${DOCS}/${f}`;
    const was = await Bun.file(path).text();
    let text = was;
    for (const key of Object.keys(NAMES) as (keyof Tweaks)[])
      text = text.replace(new RegExp(`(${NAMES[key]}[^.\\n]*?)(on the left|in the middle|on the right)`, "g"), `$1${PHRASE[t[key]]}`);
    if (text !== was) await Bun.write(path, text);
  }
}

// `bun --hot` re-runs this file; keep the server on globalThis and reload() it, or each edit starts a second listener.
const g = globalThis as typeof globalThis & { app?: ReturnType<typeof Bun.serve>; updating?: boolean };
const options = {
  port: 3000,
  routes: {
    "/": index,
    "/api/tweaks": {
      GET: () => new Response(FILE),
      POST: async (req: Request) => {
        const t = Tweaks.parse(await req.json());
        if (g.updating) return new Response("already updating", { status: 409 });
        g.updating = true;
        g.app!.timeout(req, 0); // the pipeline can go quiet for a minute; don't drop the stream
        await Bun.write(FILE, JSON.stringify(t) + "\n");
        await syncDocs(t);
        const proc = Bun.spawn(["bun", "pipeline/update.ts"], {
          cwd: ROOT,
          stdout: "ignore",
          stderr: "pipe",
          env: { ...process.env, FORCE_COLOR: "0" }, // the panel matches on plain lines
        });
        proc.exited.then(() => (g.updating = false));
        // Exit code on its own last line so the panel can tell a finished run from a crash.
        const exit = new TransformStream({
          flush: async (c) => c.enqueue(new TextEncoder().encode(`\nexit ${await proc.exited}\n`)),
        });
        return new Response(proc.stderr.pipeThrough(exit), { headers: { "content-type": "text/plain" } });
      },
    },
  },
  development: { hmr: true },
};

if (g.app) g.app.reload(options);
else g.app = Bun.serve(options);

console.log(`app on ${g.app.url}`);
