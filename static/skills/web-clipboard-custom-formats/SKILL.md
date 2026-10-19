---
name: web-clipboard-custom-formats
description: Implement copy/paste of custom data (JSON, app-specific structures) in a web app via the Clipboard Events API, execCommand("copy"), HTML-embedded payloads, or Chromium Web Custom Formats. Use when a web app needs a Copy/Paste button for its own data, when copying "doesn't work" across tabs/apps, or when debugging what the browser clipboard exposes.
metadata:
  author: mastermakrela
  source: https://alexharri.com/blog/clipboard
---

## The two APIs and what each can do

- Async Clipboard API (`navigator.clipboard.read/write`, `ClipboardItem`): callable any time the document is focused and permission is granted. Only `text/plain`, `text/html` and `image/png` are allowed on write; anything else rejects with "Type X not supported on write". Chromium additionally accepts `web ` prefixed types (Web Custom Formats, below). `read()` never returns files from the OS.
- Clipboard Events API (`copy`/`cut`/`paste` events, `event.clipboardData` is a `DataTransfer`): accepts ANY type string in `setData`/`getData`, including files on paste. Only works inside an event the user agent dispatched (`event.isTrusted === true`): a real ⌘C/⌘V/Ctrl+C/Ctrl+V, or `document.execCommand('copy')`. Synthetic events dispatched with `dispatchEvent` never touch the system clipboard.

Consequence: a custom format needs the Clipboard Events API or Web Custom Formats. A "Paste" button cannot read custom types or files; only the user's paste gesture can.

## Recipe: copy custom data from a button (works in all browsers)

```js
function copyCustom(payload) {
  const onCopy = (e) => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', payload.text);          // what other apps see
    e.clipboardData.setData('text/html', payload.html);           // rich paste targets
    e.clipboardData.setData('application/x-myapp+json', JSON.stringify(payload.data)); // your own tabs
  };
  document.addEventListener('copy', onCopy, { once: true });
  // Safari: without a selection execCommand('copy') returns false (verified Safari 27.2), so select a temporary input.
  const sink = document.createElement('input');
  sink.value = ' ';
  document.body.append(sink);
  sink.select();
  const ok = document.execCommand('copy'); // dispatches a TRUSTED copy event
  sink.remove();
  return ok;
}
```

Notes:
- `execCommand('copy')` is deprecated but is exactly what Google Docs uses; it is the only cross-browser way to get a trusted copy event from a click.
- Custom types are stored in a browser-private OS pasteboard entry (Chrome `org.chromium.web-custom-data`, Firefox `org.mozilla.custom-clipdata`, Safari `com.apple.WebKit.custom-pasteboard-data`). They round-trip between tabs of the same browser, not to native apps and not across browsers. Safari also limits them to the same origin.
- Always include `text/plain` (and usually `text/html`) so pasting elsewhere still does something sensible.

## Recipe: paste custom data (all browsers)

```js
document.addEventListener('paste', (e) => {
  const raw = e.clipboardData.getData('application/x-myapp+json');
  if (raw) {
    e.preventDefault();
    return handle(JSON.parse(raw));
  }
  // fall through to HTML / text / files
  for (const file of e.clipboardData.files) { /* images, Finder-copied files */ }
});
```

- A document-level listener receives the paste even with no focused editable; inspect `e.clipboardData.types` to see every representation.
- Files copied from Finder/Explorer show up in `clipboardData.files` on paste only, never through `navigator.clipboard.read()`.
- `execCommand('paste')` is unreliable (false in Chrome/Firefox on macOS); do not build on it.

## Recipe: Figma-style, survives across apps and browsers

Embed the custom payload inside the HTML representation so it travels through the OS `text/html` format:

```js
const html = `<div data-myapp="${btoa(JSON.stringify(data))}"></div>${visibleHtml}`;
e.clipboardData.setData('text/html', html);
// on paste: parse getData('text/html'), read data-myapp, atob + JSON.parse
```

This is the most robust approach when the data must cross browsers or reach a native companion app.

## Recipe: Web Custom Formats (Chromium only, async API)

```js
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
await navigator.clipboard.write([new ClipboardItem({
  'text/plain': new Blob([text], { type: 'text/plain' }),
  'web application/json': blob,
})]);
// read: item.types.includes('web application/json') → item.getType(...)
```

- Needs a user gesture (otherwise `SecurityError: Must be handling a user gesture to use custom clipboard`) and, unlike a plain `write()`, asks for the full clipboard permission, so the first call shows a prompt and the promise stays pending until the user answers.
- Written to the OS as `org.w3.web-custom-format.map` plus `org.w3.web-custom-format.type-N` entries, so an updated native app can read them.
- Firefox and Safari reject the `web ` prefix; feature-detect with `ClipboardItem.supports?.('web application/json')` and fall back to the copy-event recipe.
- Chromium `read({ unsanitized: ['text/html'] })` returns HTML without sanitization.

## Permissions and gotchas

- `navigator.clipboard.read()` prompts for `clipboard-read` permission in Chromium; Firefox shows a one-off paste button; Safari shows a paste popup. `write()` of text needs no prompt when triggered by a user gesture.
- Both async methods throw `NotAllowedError` when the document is not focused, including when DevTools has focus.
- `clipboardchange` event (Chromium) fires when the clipboard changes while the page is focused; other browsers need a focus-based poll.
- Drag and drop: during `dragover` the `DataTransfer` is in protected mode, `types` is visible but `getData` returns "" and `files` is empty. Full data, `webkitGetAsEntry()` and `getAsFileSystemHandle()` are available only in `drop`.

## What the playground shows

- `/` – one screen per probe: async read with environment table, paste inspector (types, items, files, per-type contents), drag hover vs drop snapshot, write buttons for each type including the failing ones. Press ⌘V / Ctrl+V, drop a file, or right-click.
- `/about` – explanation of the concepts and the link to the article.
- `/llms.txt` – this file.
