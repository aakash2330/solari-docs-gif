import index from "./index.html";

// 3001 belongs to Docusaurus. This process only ever owns 3000.
//
// `bun --hot` re-runs this file on every edit. Without holding the server on
// globalThis, each reload starts a *second* listener rather than replacing the
// first, so editing the port below once left one process bound to 3000 and 3001
// at the same time — taking the port the docs need. reload() swaps the handlers
// on the existing listener instead.
const options = { port: 3000, routes: { "/": index }, development: { hmr: true } };

const g = globalThis as typeof globalThis & { app?: ReturnType<typeof Bun.serve> };
if (g.app) g.app.reload(options);
else g.app = Bun.serve(options);

console.log(`app on ${g.app.url}`);
