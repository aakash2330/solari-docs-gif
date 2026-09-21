// Strips every GIF embed from the docs and deletes the GIF files. Run before a fresh pipeline pass.
const DOCS = "docs/docs";
const IMG = "docs/static/img";

for await (const f of new Bun.Glob("**/*.md").scan(DOCS)) {
  const path = `${DOCS}/${f}`;
  const text = await Bun.file(path).text();
  const clean = text.replace(/\n*!\[[^\]]*\]\([^)]+\.gif\)\n/g, "\n");
  if (clean !== text) {
    await Bun.write(path, clean);
    console.error(`stripped ${path}`);
  }
}
for await (const f of new Bun.Glob("**/*.gif").scan(IMG)) {
  await Bun.file(`${IMG}/${f}`).delete();
  console.error(`deleted ${IMG}/${f}`);
}
// Bun.write recreates out/ on the next run.
await Bun.$`rm -rf out`;
console.error("emptied out/");
