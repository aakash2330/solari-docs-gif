# docs-gif

Your docs are showing a button that moved three releases ago. This fixes that.

Give it a help page. It reads the how-to sections, performs each one in a Solari cloud
browser against the live app, screenshots every step, stitches a GIF, checks the end
state, **writes the GIF back into the markdown**, and returns a JSON manifest: which
section, which GIF, whether it passed. Wrong GIFs are flagged, not shipped.

The loop closes. Change the UI, re-run, the GIFs redraw themselves. That is the demo:
move a button with one CSS line on the left, watch the doc GIF on the right update while
you look at it.

Lead with the problem, not the tool. Scribe, Tango, Guidde and Supademo all sell the
recording. None of them re-record when your UI moves. That gap is the whole product.

Working title in the cookbook's voice: *"a help page in, verified GIFs out, the wrong ones
flagged."*

## What this actually is (re-read 20 Sep 2026)

This is not a hackathon. It is a hiring funnel: Pinetree Research SWE intern, $300K
annualized. Fork `solari-sdk/solari-cookbook` (must be a public fork of the original),
build a real use case, post on X or LinkedIn tagging @harrychow_ and @getsolari. Every
tagged build is reviewed; good ones get an interview and possibly an offer on the spot.
AI-assisted builds are explicitly encouraged. No deadline found. Submissions clustered
1–11 Sep and have gone quiet since — not late, but ship in days.

Harry Chow (Head of Growth) is the front door; his GitHub is dormant. Engineers do the
review. A merge is not required and the queue is frozen (all 12 merges landed 8 Sep,
nothing since, 31 open). The fork is the submission.

Consequence: this is not zero-sum, positioning matters less than I first thought, and the
single thing that matters most is **does it run end to end on a stranger's machine with
only a `slr_live_` key.**

That constraint decides the demo target (20 Sep, second pass). A cookbook entry is a
recipe, not a product: it is judged on whether a reviewer can read the whole loop in five
minutes and see how to point it at their own docs. Aimed at a real repo — Superset,
Immich — most of the code becomes glue for someone else's ⋮ menus and login, the recipe
gets buried, and the reviewer needs an account before anything runs. So we ship **both
sides**: a small demo app and its docs, in-tree, running from one command. The app is
ours precisely because the demo requires changing the UI on cue — you cannot move a button
in Immich.

## Where it lives

`applications/docs-gif/`, not `examples/`. The applications tier wants "a CLI or a UI,
its own modules, usually its own tests, solving a whole problem." Its only current peer is
`worldline` (plan → verify → replay only the winner). That tier's README reads almost
word-for-word like this project: *"someone deciding whether Solari fits their pipeline
wants to see a real one."*

Applications-tier rules that differ from the examples rules I had before:

- A second vendor key **is allowed**. Say so in the README, fail with a clear message when
  it is missing, and never list a var in `.env.example` the code doesn't read.
- "If the agent is a stub, say it's a stub." Claims never exceed code.
- No `CLAUDE.md`, `AGENTS.md`, untouched starters, build output, or lockfiles for deps you
  don't have. They name these explicitly.
- Deps from a registry, not vendored. Nothing outside the directory changes except one
  row in `applications/README.md`.
- Tests are expected. Minimum: manifest schema, assertion logic, GIF stitching, all
  against fixtures without a network.

## Why this and not something else

**The field.** 31 open PRs. Twelve of them are verification/proof/assert themed, and two
verification examples are already merged (`browser-page-assertions-py`,
`form-delivery-check-ts`). So verification is the house style, not a differentiator.
Nearly everything is a dev tool: QA agents, sandbox caching, DLQ replay, git clone, PTY
wizards, database audits. About two are aimed at non-engineers. Nothing produces a visual.
Nothing produces content an end user would see.

**The lane.** This is the only submission whose output is content that ships to
customers, reviewed first by a growth lead. Lead with the audience, not the check.

**What it composes.** Four primitives already in the cookbook — `browser-profiles-ts`,
`browser-login-handoff-ts`, `browser-session-recording-py`, `browser-page-assertions-py`
— into one program. That is precisely what the applications tier is for.

**What the platform is investing in.** September changelog: stealth fleet 5×, Starter
concurrency 3→10 (16 Sep), platform moved to redundant infra + GPUs (10 Sep), login
handoff links that open without a Solari account (3 Sep). All browser. Snapshots got a
bug fix and a price tag (storage billing from 1 Oct). This project uses the things they
are actually shipping.

**Nearest twins — read both before writing a line:**

- [#9 ghostspec](https://github.com/solari-sdk/solari-cookbook/pull/9): English → verified
  Playwright test. Same spine, different output. Differentiate on audience: they produce
  a test for engineers, we produce content for customers.
- [#50 self-healing-e2e-ts](https://github.com/solari-sdk/solari-cookbook/pull/50): replay
  a recorded test against a moved DOM, catch the drift. Same spine as our regeneration
  loop — say so in one line rather than hoping nobody notices. They repair a *test* so
  engineers stop getting paged; we regenerate *content a customer reads*. Their output
  goes green in CI, ours ships to a help page. Different consumer, different artifact.

**Prior art to own in the README, one line:** Claude in Chrome ships `gif_creator` (click
overlays, action labels, progress bar). Scribe/Tango/Guidde/Supademo sell the same clip.
Recording is the easy half. Reading the docs, deciding what deserves a GIF, deriving the
steps, and refusing the wrong ones is the product.

## Output

```json
{
  "source": "http://localhost:3000/docs/moving-a-task",
  "generated_at": "2026-09-20T…",
  "sections": [
    { "heading": "How boards work", "anchor": "#how-boards-work",
      "gif": null, "status": "skipped", "reason": "conceptual, no steps" },
    { "heading": "Move a task between columns", "anchor": "#move-a-task",
      "goal": "the task card sits in the Done column",
      "gif": "out/move-a-task.gif",
      "embedded_in": "docs/docs/moving-a-task.md",
      "status": "verified", "assertion": "card 'Ship the recorder' is under Done" },
    { "heading": "Archive a task", "anchor": "#archive",
      "goal": "…", "gif": null, "embedded_in": null,
      "status": "failed", "assertion": "archived row in the sidebar — not found" }
  ]
}
```

- Anchor on the fragment id, not the heading text. Emit both.
- `null` with a reason is a feature: it is the evidence of judgment.
- Status per section means the pass/fail contrast is one file, not two runs.
- GIF paths go to a gitignored `out/`. The manifest is text and one fixture manifest is
  committed so the default run needs no model key.
- `embedded_in` is the file the GIF was written into, `null` when nothing was written.
  That field is what makes the manifest an audit trail rather than a receipt: it says
  which docs changed on this run.

## Architecture

Three players. **Your Node process** is the boss. **Solari** holds a real browser in the
cloud. **Claude** is an HTTP API that only ever *decides* — it never touches the browser.

**Stage 1 — plan.** Docs URL → manifest plan. One call per page. Claude Opus 5
(`claude-opus-5`), adaptive thinking, effort `high`, structured outputs so the JSON is
guaranteed to validate. It splits the page into sections, decides which deserve a GIF
(conceptual → skipped with reason), derives the steps and one assertion per section.
Requires `ANTHROPIC_API_KEY`. Its output for one page is committed as the fixture.

**Stage 2 — record.** Per section, drive a Solari browser through the steps. The model
sees an **accessibility tree with numbered refs**, never raw HTML (hundreds of thousands
of tokens vs a few thousand) and never writes CSS selectors (it will invent one). It
replies with a ref; the code maps ref → element. Tools: `navigate`, `click(ref)`,
`type(ref, text)`, `screenshot`, `done`. Use the SDK's tool runner — the loop is already
written, you write the five functions. Effort `low`. Cache the stable prefix (system
prompt + tool defs + docs text) — it is identical on every step and is the biggest cost
lever, bigger than switching models. Screenshot after each step is one GIF frame.

**Assertion.** Once per flow, not per step: tree + the final screenshot. Vision only
here, where "does this look right" is the question and it is the check the whole idea
rests on.

**Stitch.** ffmpeg from the step screenshots, slow frame rate. Optional overlays stolen
from `gif_creator`: a circle at the click point, a short action label per frame. Decide
during build: stitch locally via a registry ffmpeg package, or in a Solari sandbox
(removes the reviewer's ffmpeg dependency, makes this a browser + sandbox multi-product
app — a category the cookbook README calls out — and can serve the GIF via
`previewUrl`). Lean sandbox; fall back to local if it adds a day.

**Embed.** Write the GIF next to the markdown and rewrite that section's image line to
point at it. Only sections that passed the assertion are written; a failed section leaves
the existing image untouched, which is the whole point of asserting first. Docusaurus'
dev server hot-reloads on file write, so "the docs update in real time" needs no watcher,
no plugin and no CMS — it falls out of writing the file. One regex over the section body,
not a markdown AST: we control the docs, and an AST is a dependency for a one-line edit.

**Fan-out.** Sections are independent → one browser per section in parallel. Free tier is
3 concurrent; Starter is now 10. Run-scoped `metadata` on every create.

**Login.** Off the critical path now — the demo app has no auth. This is for the real-run
proof of decision 14 only, so do not let it block step 1. Profiles hold the session. Login
handoff (3 Sep) gives a single-use link that
opens without a Solari account, 30-minute expiry, bound to one profile — record logged-in
flows on a throwaway account without a password in the code. Cookbook gotcha: a profile
does not seed the browser on its own; pass `session.storageState` to `newContext`,
`addCookies` is not a substitute, and pass `timezoneId` through if a proxy is attached.

**Default run** (`npm start`, Solari key only): fixture manifest in → record → assert →
stitch → embed → manifest out. **Agent run** (`--from-url`): Stage 1 first, then the same.
**Regenerate** is not a third mode — it is the default run a second time, after the UI
moved. That it needs no new flag is the argument.

## Decided

1. The agent is the hard part, not the recording. Keep the recording code dumb.
2. GIFs from screenshots, not video and not rrweb replay (replay is DOM data, not pixels,
   and has had reliability issues).
3. Assert the end state before keeping a GIF. A wrong GIF is worse than none.
4. Two modes. Default = fixture + Solari key only. Agent = optional `ANTHROPIC_API_KEY`,
   preflighted before any billable session opens. Both produce the same manifest.
5. **Write back into the docs.** (Reversed 20 Sep — was "read-only, a human pastes.") The
   pipeline writes the GIF and rewrites that section's image line. Verified sections only.
   The manifest records every file it touched. Read-only made this a still life; the write
   is what closes the loop.
6. **Regeneration is the demo, not a roadmap line.** (Reversed 20 Sep — was "generate-once,
   no self-healing.") Change the UI, re-run, the GIFs redraw. Still no *self*-healing: the
   agent never repairs a broken flow, it re-derives the flow from the docs on every run.
   A flaky run is still a human's problem.
7. Refs from the accessibility tree, never selectors, never pixel coordinates.
8. No computer use. We have a DOM; pixel-driving is slower, costlier, and misses by four
   pixels.
9. No Jev / third-party browser framework in v1. Second vendor key, and it puts Solari
   behind someone else's abstraction in a Solari showcase. What it would replace is ~30
   lines of element selection. Pluggable later if wanted.
10. No snapshots/revert. They are sandbox/desktop features, not browser; and reverting a
    VM does not un-create anything on the SaaS side, which is the state a docs GIF needs
    reset. Documented here so nobody re-asks.
11. Not pivoting. Nothing found clears the bar more reliably and is more memorable.
12. Fail-open honesty in the README: what the agent handles, where it falls over, what
    was verified live, when, on which plan.
13. **Own demo app, own docs, both in-tree.** A cookbook entry is a recipe, judged on
    whether a reviewer reads the whole loop in five minutes. A real repo buries the recipe
    in someone else's UI and puts an account between the reviewer and the first run.
    Stated plainly in the README: a declared assumption costs nothing, a hidden one costs
    everything.
14. **One real run as proof, kept separate from the demo.** The standing objection to a
    demo app is "it only works because he built both sides." Answer it once: point the
    pipeline at a real docs page and a real app, commit that manifest, screenshot it in
    the README. The demo app is the recipe; the real run is the evidence. One afternoon.
15. **The demo app must be genuinely awkward.** A ⋮ overflow menu, a drag between columns,
    a modal with three fields, a detail panel that slides over. Never `<button
    id="create">`. An app built to be easy to drive proves nothing about the agent.

## Build plan

0. **Build the demo app and its docs. Resolved 20 Sep — no longer blocking.** A
   Linear-style task board as one `app.html` served by `Bun.serve`, no framework, ~200
   lines. Flows chosen to be awkward in prose and obvious in a GIF: drag a card between
   columns, open the detail panel, assign via a ⋮ menu, filter. Docs via
   `create-docusaurus` — three or four how-tos, one conceptual section that must get
   skipped, one flow that must fail. Both in-tree, both running from one command.
1. Step-driven recorder against it: fixture manifest → screenshots → GIF → assertion →
   embed → manifest. Solari key only. This is `npm start`. Tests against fixtures, no
   network.
2. Stage 1 plan: docs URL → manifest via structured outputs. Commit its output as the
   fixture.
3. Stage 2 agent path: tree + refs tool loop. Same manifest out.
4. The regeneration demo. Move a button in `app.html` with one CSS line, re-run, watch the
   GIF in the docs redraw. Split screen, editor left, docs right. This is the post — shoot
   it before writing the README, because it decides what the README has to claim.
5. README: what it does, honest capability statement, every gotcha met during the build
   in a comment where it bites, the Claude-in-Chrome line, the #50 differentiation line,
   and one flat sentence — *the demo app and its docs are ours, so the loop can be shown
   closing end to end* — next to the committed real-run manifest from decision 14.
6. Post: the GIFs + a screenshot of the manifest showing all three statuses. Tag
   @harrychow_ @getsolari.
7. After, separately: `examples/desktop-revert-undo-ts` — first live demo of the fixed
   `revert()`, unclaimed as of 17 Sep. Twenty lines. Four of the twelve merges were small
   fixes; this is the cheapest merged PR with your name on it.

## Cookbook hygiene (each item has closed someone's PR)

- Never edit root README or LICENSE. One row in `applications/README.md`, nothing else
  outside the directory.
- `.env.example` lists every var read and nothing else. Second key: say so, fail clearly.
- `kill()` not `close()` for VMs. `browser.close()` alone exits as of `@solarisdk/browser`
  0.1.3. Release in `finally`. SIGINT handler. Run-scoped `metadata` on every create.
- Recording is per session: `recording: true` at create or the replay 404s forever; upload
  is async, poll ~30s. (We mostly screenshot instead.)
- `contexts()` is empty on a plain `launch()`; use `newContext()`.
- No binaries, GIFs, videos, or submission material in the tree.
- README claims never exceed the code.
- Every SDK call must exist in the `.d.ts`.
- No `CLAUDE.md` / `AGENTS.md` in the tree.
- When the Claude code is written: server-side refusal fallbacks on by default.

## Risks

- Agent reliability on an unseen UI → fixture default, refs not selectors, assertion
  gate, honest README.
- ~~Demo product undecided~~ → resolved 20 Sep: we ship the app and its docs (decision 13).
- "It only works because he built both sides" → the real-run manifest of decision 14, and
  a demo app deliberately built awkward (decision 15). This is the objection most likely
  to be voiced; answer it in the README before anyone has to ask.
- Writing into the docs means the pipeline can corrupt them → only verified sections are
  written, the rewrite is one image line inside one section, and the run is on a branch.
  A failed section is left exactly as it was.
- Twins #9 and #50 → differentiate on audience and output, say so in one line.
- `gif_creator` exists → own it; recording is the easy half.
- Free tier: 3 concurrent browsers, 1-hour sessions, us-west only.
- Reviewer's machine lacks ffmpeg → registry package or sandbox stitch.

## Links

- Brief: https://x.com/harrychow_/status/2094437473912844480 (must be a public fork:
  https://x.com/harrychow_/status/2094619034956292275)
- Cookbook: https://github.com/solari-sdk/solari-cookbook
- Applications tier: https://github.com/solari-sdk/solari-cookbook/tree/main/applications
- Open PRs: https://github.com/solari-sdk/solari-cookbook/pulls
- Docs: https://docs.getsolari.com — Changelog: https://changelog.getsolari.com
- Discord for issues: linked from Harry's follow-up tweet.

## Research log (20 Sep 2026)

- Cookbook: 31 open PRs, 12 merged, all merges on 8 Sep. 4/12 merges were fixes to
  existing examples. ~12/31 open are verification-themed. ~2/31 aimed at non-engineers.
  0 visual.
- `applications/` has one entry (worldline). Rules read directly from its README.
- Changelog 1–16 Sep: browser investment (stealth 5×, concurrency raise, infra, GPUs),
  login handoff for end users (3 Sep), `revert()` fixed and made safe (3 Sep),
  recordings across revert (6 Sep), snapshot storage billing from 1 Oct.
- Snapshot/revert/fork are listed under Sandboxes and Desktops only. Cloud browser:
  Playwright/CDP, stealth, proxies, profiles, recording, captcha.
- Harry Chow GitHub: no recent public events; stars are old and generic. Front door, not
  reviewer.
- Claude in Chrome tool surface: `read_page` returns an accessibility tree with `ref_N`;
  `computer` clicks by ref or coordinate; `gif_creator` records and exports with overlays.
- Jev (TypeSafe System One): LLM plans, Jev picks element/action/value, ~300 ms per
  round; library/CLI/MCP; several near-identical forks exist — pin the canonical one if
  ever used.

### Second pass, same day — demo target

Surveyed real docs sites as record targets before deciding to ship our own. Kept here so
the option is not re-litigated:

- Docs generators are Markdown → HTML. Verified by generator tag: Jest, Jellyfin,
  Excalidraw and Prettier/Redux/Babel/Ionic are Docusaurus; Vue and VitePress are
  VitePress; FastAPI moved to Zensical; Pydantic to Astro; react.dev and Expo are custom.
  Mintlify sites serve raw markdown by appending `.md`, plus `/llms.txt` — checked live
  against `docs.anthropic.com` (200, `text/markdown`). So reading docs needs no browser.
- Immich looked strongest: docs are Docusaurus in-repo, `demo.immich.app` logs in with one
  click, search returns real photos for "dog on a beach". Rejected on step density — its
  feature docs run 0–8 list items and are description plus stills, not UI walkthroughs.
  Map view also fails to load tiles, and uploads are disabled on the demo.
- Superset has the step density we wanted (13 numbered steps in
  `creating-your-first-dashboard.mdx`; ⋮ menus, drag-to-nest, right-click → Move to
  folder) but no public instance — a reviewer would need `docker compose up` first.
- Penpot is out: `penpot/penpot-docs` has 30 markdown files and zero user-guide pages.
- Conclusion: no candidate has forkable docs *and* complex UI *and* a zero-setup live
  instance. And none of them let us move a button on cue, which the regeneration demo
  requires. Hence decisions 13–15.
