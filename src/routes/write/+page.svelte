<script lang="ts">
	import { copyViaEvent } from '#lib/copy.ts';

	type Rep = { id: number; type: string; value: string };
	type Result = { id: number; ok: boolean; how: string; msg: string };

	// the only types navigator.clipboard.write() accepts without the "web " prefix
	const MANDATORY = ['text/plain', 'text/html', 'image/png'];
	const SUGGESTED = ['text/plain', 'text/html', 'text/uri-list', 'application/json', 'application/x-myapp+json'];

	let nextId = 0;
	let reps = $state<Rep[]>([
		{ id: nextId++, type: 'text/plain', value: 'Hello, world' },
		{ id: nextId++, type: 'text/html', value: '<b>Hello</b>, <i>world</i>' },
		{ id: nextId++, type: 'application/x-myapp+json', value: '{"shape":"circle","r":12}' }
	]);
	let results = $state<Result[]>([]);
	let waiting = $state('');

	// empty types are skipped; a repeated type keeps its last value, as setData would
	const entries = $derived([...new Map(reps.filter((r) => r.type.trim()).map((r) => [r.type.trim(), r.value])).entries()]);

	const fmt = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
	const item = (pairs: [string, string][]) =>
		new ClipboardItem(Object.fromEntries(pairs.map(([t, v]) => [t, new Blob([v], { type: t })])));
	const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

	function log(ok: boolean, how: string, msg: string) {
		waiting = '';
		results = [{ id: nextId++, ok, how, msg }, ...results].slice(0, 8);
	}

	function viaEvent() {
		const { ok, trusted } = copyViaEvent(entries);
		log(ok, 'copy event', `${entries.length} type(s), isTrusted=${trusted}, execCommand returned ${ok}`);
	}

	async function viaWrite() {
		try {
			await navigator.clipboard.write([item(entries)]);
			log(true, 'clipboard.write()', `${entries.length} type(s) written`);
		} catch (e) {
			log(false, 'clipboard.write()', fmt(e));
		}
	}

	async function viaWebFormats() {
		const pairs = entries.map(([t, v]): [string, string] => [MANDATORY.includes(t) || t.startsWith('web ') ? t : `web ${t}`, v]);
		// Chromium asks the full clipboard permission for custom formats (a plain write only checks it)
		waiting = 'Web Custom Formats: waiting for the clipboard permission prompt in the address bar…';
		try {
			await navigator.clipboard.write([item(pairs)]);
			log(true, 'web custom formats', `written as ${pairs.map(([t]) => t).join(', ')}`);
		} catch (e) {
			log(false, 'web custom formats', fmt(e));
		}
	}

	// Figma's trick: smuggle the non-standard types inside text/html, which every OS clipboard carries
	async function viaHtml() {
		const custom = entries.filter(([t]) => !MANDATORY.includes(t));
		const plain = entries.find(([t]) => t === 'text/plain')?.[1] ?? '';
		const visible = entries.find(([t]) => t === 'text/html')?.[1] ?? esc(plain);
		const html = `<span data-payload="${b64(JSON.stringify(Object.fromEntries(custom)))}"></span>${visible}`;
		try {
			await navigator.clipboard.write([item([['text/plain', plain], ['text/html', html]])]);
			log(true, 'embedded in text/html', `${custom.length} custom type(s) base64-encoded into data-payload`);
		} catch (e) {
			log(false, 'embedded in text/html', fmt(e));
		}
	}

	const ways = [
		{ label: 'Copy via copy event', run: viaEvent, note: 'Any type, every browser. Same-browser paste only for custom types.' },
		{ label: 'navigator.clipboard.write()', run: viaWrite, note: 'Rejects everything except text/plain, text/html and image/png.' },
		{ label: 'As Web Custom Formats', run: viaWebFormats, note: 'Prefixes custom types with "web ". Chromium only, asks for clipboard permission.' },
		{ label: 'Embedded in text/html', run: viaHtml, note: 'The Figma approach: survives other browsers and apps.' }
	];
</script>

<svelte:head><title>Write · Clipboard playground</title></svelte:head>

<main>
	<h1>Write your own clipboard</h1>
	<p class="lede">
		Put several representations on the clipboard at once, including types you make up. Then paste
		on the <a href="/">playground</a> with <kbd>⌘V</kbd> to see which ones arrived.
	</p>

	<datalist id="types">
		{#each SUGGESTED as t (t)}<option value={t}></option>{/each}
	</datalist>

	<div class="reps">
		{#each reps as rep, i (rep.id)}
			<div class="rep">
				<input list="types" bind:value={rep.type} aria-label="Type {i + 1}" placeholder="type, e.g. application/x-myapp+json" spellcheck="false" />
				<textarea bind:value={rep.value} aria-label="Value {i + 1}" rows="2" spellcheck="false"></textarea>
				<button class="remove" onclick={() => reps.splice(i, 1)} aria-label="Remove {rep.type || 'row'}">×</button>
				{#if rep.type.trim() && !MANDATORY.includes(rep.type.trim())}
					<span class="tag">custom</span>
				{/if}
			</div>
		{/each}
		<button onclick={() => reps.push({ id: nextId++, type: '', value: '' })}>Add representation</button>
	</div>

	<div class="ways">
		{#each ways as w (w.label)}
			<div class="way">
				<button class="primary" onclick={w.run} disabled={!entries.length}>{w.label}</button>
				<span class="muted">{w.note}</span>
			</div>
		{/each}
	</div>

	{#if waiting}
		<p class="muted waiting">{waiting}</p>
	{/if}
	{#if results.length}
		<ul class="log">
			{#each results as r (r.id)}
				<li class={r.ok ? 'ok' : 'err'}><strong>{r.how}</strong> <span class="mono">{r.msg}</span></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main { width: 100%; max-width: 760px; margin: 0 auto; padding: 56px 20px 120px; }
	.lede { color: var(--muted); margin: 16px 0 40px; }
	.reps { display: grid; gap: 10px; justify-items: start; }
	.rep { position: relative; display: grid; grid-template-columns: minmax(0, 17rem) minmax(0, 1fr) auto; gap: 8px; width: 100%; align-items: start; }
	.rep input { font-family: var(--mono); font-size: 13px; }
	.rep textarea { font-family: var(--mono); font-size: 13px; resize: vertical; min-height: 38px; }
	.remove { padding: 7px 11px; }
	.tag { position: absolute; top: -8px; left: 10px; padding: 0 6px; font-size: 11px; color: var(--accent); background: var(--bg); }
	.ways { display: grid; gap: 12px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); }
	.way { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 4px 14px; align-items: center; }
	.way .muted { font-size: 13.5px; }
	.waiting { margin: 32px 0 0; }
	.log { list-style: none; padding: 0; margin: 32px 0 0; display: grid; gap: 6px; font-size: 13.5px; }
	.log strong { font-weight: 600; margin-right: 6px; }
	@media (max-width: 560px) {
		.rep { grid-template-columns: minmax(0, 1fr) auto; }
		.rep textarea { grid-column: 1 / -1; grid-row: 2; }
		.way { grid-template-columns: minmax(0, 1fr); }
	}
</style>
