# docs-gif

A how-to page goes in. A verified GIF comes out, embedded under the steps it shows.
Pages whose steps don't work on the real app get flagged instead of illustrated.

The app runs in a Solari sandbox, a Solari browser drives it, and a checker compares
the screen before and after against the page's own words. Nothing here is tied to the
demo app: point it at any web app with a docs folder.

## How a page becomes a GIF

1. **Plan.** A model reads the page and writes one goal per how-to section: the end
   state a reader should see, in one sentence ("every row shows Done and a Reset button
   appears"). Conceptual sections get nothing.
2. **Record.** A browser agent gets the goal and the page's accessibility tree, picks
   the next click, and says "done" when the screen shows the goal. Each click is a
   frame. The frames become a GIF with a cursor and a spotlight on what was clicked.
3. **Check.** The checker sees the first frame, the last frame and the goal, and answers
   yes or no with a reason. A no gets one retry, with the reason folded into the
   agent's instructions.
4. **Write.** A verified GIF lands in `docs/static/img` and is embedded at the end of
   its section. A failed one is kept as `.failed.gif` under `out/`, with the checker's
   reason in the log, and the page is left alone.

Every run writes `out/<timestamp>/log.txt` with each step, click, verdict and timing.

## Where Solari comes in

- **The app runs in a sandbox.** `npm run snapshot` builds it once: a base sandbox gets
  Node, this repo's `app/` and `pipeline/serve.ts`, `npm ci`, and the app server on
  port 3000. Then it is snapshotted and killed. Every run after that boots a sandbox
  from the snapshot in about half a minute and reaches the app through its preview URL.
- **A Solari browser drives it.** The pipeline creates a browser session, connects
  Playwright over CDP, and sends the sandbox's preview token as a header so the browser
  is allowed in.
- **Both are released at the end of every run**, failed runs included. A sandbox left
  running bills until its idle timeout.

Two SDK details worth knowing:

- A sandbox handle from `create()` can run commands straight away, but `files.write`
  and `files.upload` need `await sbx.connect()` first. Both call sites here do that.
- The snapshot listing lags a few seconds behind a build. Give it a moment between
  `npm run snapshot` and the first run.

## Setup

Node 24 and npm.

```bash
npm install
cp .env.example .env       # then fill in the three keys
npm run snapshot           # build the app snapshot on Solari, about a minute
npm run docs-generate      # record every page in docs/docs/how-to
npm run dev                # app on :3000, docs on :3001, to see the GIFs in place
```

| Variable | What it's for |
| --- | --- |
| `SOLARI_API_KEY` | Sandboxes, snapshots and browser sessions. From console.getsolari.com |
| `AI_GATEWAY_API_KEY` | The planner and the checker, through Vercel's AI Gateway. The model is set in `pipeline/model.ts` |
| `TYPESAFE_API_KEY` | The browser agent that picks each click, TypeSafe's JEV model |

No GIFs are checked in. The first `npm run docs-generate` makes them: five pages, one
sandbox, one browser session, about a minute per page after boot. Open the docs on
:3001 afterwards and each how-to page has its GIF under the steps.

## Commands

```bash
npm run docs-generate                                     # every page in docs/docs/how-to
npm run docs-generate -- docs/docs/how-to/add-a-task.md   # one page
npm run docs-update                                       # only pages changed since the last commit
npm run snapshot                                          # rebuild the snapshot after changing app/ or pipeline/serve.ts
npm run clean                                             # strip embeds, delete GIFs and out/, reset the Tweak panel
```

## What it costs

Measured on a full five-page run on 28 Sep 2026:

| | |
| --- | --- |
| Wall clock | 5 min 29 s. About 40 s to boot, then about a minute per page |
| Solari | One sandbox and one browser for that long, about 2.5 cents at list price |
| AI Gateway | 10 calls, planner and checker, 0.8 cents |
| TypeSafe | 20 clicks, not metered here |

Solari has no balance endpoint; the console shows credit. The AI Gateway does, and
`pipeline/model.ts` is the place to swap the model or drop the 12-second spacing that
keeps a free-tier key under its rate limit.

## Try it: move the UI, watch the docs follow

Open **Tweak the UI**, bottom right of the app on :3000. Two rows: the Status filter and
the Add Task button. Each moves its control to the left, middle or right of the toolbar.
Opening a row rings the control it moves. Nothing happens until **Done**.

Done does three things: saves the layout, rewrites the sentence in the docs that says
where the control is ("Select **Status** in the toolbar, above the table on the left"),
and runs `npm run docs-update`, which re-records exactly the pages git now sees as
changed. The panel shows each stage, from starting the sandbox to checking the GIFs, and
then links to the re-recorded page on :3001. If the move changes no sentence, the panel
says so instead of pretending.

The docs are the source of truth. `app/tweaks.json` is only how the app remembers the
layout, and it is copied into the sandbox at the start of every run, so a moved control
shows up in recordings without a new snapshot. A change to `app/` code or
`pipeline/serve.ts` does need `npm run snapshot` first.

## Try it: a page that lies

Rename the "Done" status to "Complete" in `app/tasks/data/data.tsx`, rebuild the
snapshot, and run `filtering-tasks.md`. The steps still click through, but the checker
reports rows reading Complete, not Done, and refuses the GIF. That is the failure this
pipeline exists to catch: a help page describing something the app no longer does.

## Layout

Three npm workspaces:

- `pipeline/` — `index.ts` runs the steps. `planner.ts`, `jev.ts` and `verifier.ts` are
  the three model calls. `sandbox.ts` and `browser.ts` are the Solari side. `gif.ts`
  stitches frames. `serve.ts` serves the app and the Tweak panel's endpoint
- `app/` — the demo app the GIFs are recorded against: a task list on TanStack Table,
  chosen because faceted filters, a column menu and a nested row menu are awkward to
  drive
- `docs/` — the Docusaurus site whose pages the pipeline rewrites

Only `app/` and `pipeline/serve.ts` go into the snapshot. The pipeline itself runs on
your machine.
