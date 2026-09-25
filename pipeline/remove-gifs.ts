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
await Bun.$`find ${IMG} -type d -empty -delete`.nothrow();
await Bun.$`rm -rf out`;
console.error("emptied out/");
await Bun.write("app/tweaks.json", '{"search":"left","status":"left","priority":"left"}\n');
console.error("reset app/tweaks.json");
