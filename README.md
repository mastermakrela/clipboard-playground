# Clipboard playground

Shows what the browser can see on the clipboard and in drag & drop on a single screen: paste, drop,
the bottom-left Read/Watch dock, or the right-click menu (all write paths), and the latest result
replaces the headline. `/write` builds a multi-type clipboard and writes it four ways.
`/about` has the explanations. Use it with clients who report "copy/paste doesn't work".
Background: https://alexharri.com/blog/clipboard

Agent-readable: `/llms.txt` and the skill at `/skills/web-clipboard-custom-formats/SKILL.md`
(`npx skills add <origin>/skills/web-clipboard-custom-formats/SKILL.md`).

Probes:

- **Async Clipboard API** – `navigator.clipboard.read()`: permission state, focus requirement, every
  type of every item with a preview. Optional watch mode (`clipboardchange` when supported, else
  re-read on focus + interval).
- **Paste event** – `clipboardData` on ⌘V: all types including custom ones and files copied from
  Finder/Explorer, which the async API usually hides.
- **Drag & drop** – what is visible during `dragover` (protected mode) vs after `drop`
  (names, sizes, directory entries, file-system handles).
- **Write** – writes text/html/png, tries forbidden types, `web ` custom formats and the `copy`
  event path, and shows the exact error the browser throws.

## Dev

```sh
bun install
bun run dev
bun run check
```

## Deploy (Cloudflare Workers)

Deploys to mastermakrelas Account (`account_id` is pinned in `wrangler.jsonc`), live at
https://clipboard-playground.mastermakrela.workers.dev

```sh
bun run deploy
```

The async Clipboard API requires a secure context, so test on `https://` or `localhost`.
