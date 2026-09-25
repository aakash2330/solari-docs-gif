# docs-gif

A help page in, verified GIFs out, the wrong ones flagged.

Three Bun workspaces:

- `pipeline/` — reads a docs page, drives a browser through each how-to, stitches the
  GIF, asserts the end state, writes it back into the markdown. Its `serve.ts` also
  serves the app and hosts the two routes behind the Tweak panel's Done button
- `app/` — frontend only: the demo app the GIFs are recorded against, a task list built with
  TanStack Table v9, chosen because faceted filter popovers, a column-visibility
  menu and a nested row-actions menu are genuinely awkward to drive
- `docs/` — the Docusaurus site whose pages the pipeline rewrites

```bash
bun install
bun run dev         # app on :3000, docs on :3001
bun docs-generate   # record every page in docs/docs/how-to
bun docs-update     # re-record only the pages changed since the last commit
bun run clean       # back to a fresh tree: no embeds, no GIFs, no out/, tweaks at defaults
```

## The three docs pages are not interchangeable

Each one exists to produce a different manifest status:

| Page | Expected status | Why |
| --- | --- | --- |
| `filtering-tasks.md` | `verified` | The filter works; the GIF should be written back |
| `change-a-label.md` | `verified` | The Labels submenu changes the task's label; the GIF should be written back |
| `how-the-list-works.md` | `skipped` | Conceptual, no steps to record |

A help page describing a feature that silently does nothing is the exact failure
this pipeline is for. To see it, rename the "Done" status to "Complete" in
`app/tasks/data/data.tsx` and re-run: the checker reports rows reading Complete, not
Done, and refuses the GIF.

## Try it: change the UI, watch the docs redraw

Open **Tweak the UI**, bottom right of [the app](http://localhost:3000), while `bun run dev`
is up. Each row moves one toolbar element, the search box or a filter, to the left, middle
or right of the row. Opening a row rings the element it moves. The move is only on your
screen until you press **Done**. Done rewrites the sentence in the docs that says where
the element is ("Select **Status** in the toolbar, above the table on the left"), so the
docs page changes, and `bun run docs-update` re-records exactly the pages git sees as
changed. The pipeline only ever reads the docs; `app/tweaks.json` is just how the app
remembers the layout. The panel shows each stage as the pipeline reaches it, then links
to the docs. `filtering-tasks.md` stays `verified`, with its GIF re-recorded and the
cursor going somewhere new.

To see a failure instead, rename the "Done" status to "Complete" in
`app/tasks/data/data.tsx` and press Done: the checker reports rows reading Complete, not
Done, and refuses the GIF.

The full cookbook README lands with the pipeline; this one only covers the layout.
