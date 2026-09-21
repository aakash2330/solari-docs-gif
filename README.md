# docs-gif

A help page in, verified GIFs out, the wrong ones flagged.

Three Bun workspaces:

- `pipeline/` — reads a docs page, drives a browser through each how-to, stitches the
  GIF, asserts the end state, writes it back into the markdown
- `app/` — the demo app the GIFs are recorded against: shadcn/ui's Tasks example
  (TanStack Table v9), chosen because faceted filter popovers, a column-visibility
  menu and a nested row-actions menu are genuinely awkward to drive
- `docs/` — the Docusaurus site whose pages the pipeline rewrites

```bash
bun install
bun run dev     # app on :3000, docs on :3001
bun start       # run the pipeline
```

## The three docs pages are not interchangeable

Each one exists to produce a different manifest status:

| Page | Expected status | Why |
| --- | --- | --- |
| `filtering-tasks.md` | `verified` | The filter works; the GIF should be written back |
| `change-a-label.md` | `failed` | The Labels menu is inert upstream — it renders a radio group with no `onValueChange`. The doc describes a change that never happens, so the assertion must catch it |
| `how-the-list-works.md` | `skipped` | Conceptual, no steps to record |

The inert Labels menu is deliberate, not a bug to fix. A help page describing a
feature that silently does nothing is the exact failure this pipeline is for.

The full cookbook README lands with the pipeline; this one only covers the layout.
