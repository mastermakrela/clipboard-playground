<script lang="ts">
	import { copyViaEvent } from '#lib/copy.ts';
	import { transformsFor, type Transform } from '#lib/convert.ts';

	type FileInfo = { name: string; type: string; size: number; modified: string; url?: string };
	type Entry = { kind: string; type: string; text?: string; file?: FileInfo | null };
	type Result = {
		trusted: boolean;
		at: Date;
		types: string[];
		entries: Entry[];
		files: FileInfo[];
		data: { type: string; text: string }[];
	};

	const LIMIT = 2000;
	let result = $state.raw<Result | null>(null);
	let { shown, onresult }: { shown: boolean; onresult: () => void } = $props();
	let urls: string[] = [];
	let copied = $state<string | null>(null);
	const transforms = $derived(result ? transformsFor(result.data) : []);

	function copy(t: Transform) {
		copied = copyViaEvent(t.out).ok ? t.label : null;
	}

	const clip = (s: string) => (s.length > LIMIT ? `${s.slice(0, LIMIT)}… (truncated)` : s);

	function info(f: File): FileInfo {
		const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
		if (url) urls.push(url);
		return { name: f.name, type: f.type, size: f.size, modified: new Date(f.lastModified).toISOString(), url };
	}

	function revoke() {
		for (const u of urls) URL.revokeObjectURL(u);
		urls = [];
	}

	// document-level: ⌘V reaches us with nothing focused (verified in Chrome); text fields keep native paste
	async function onpaste(e: ClipboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		e.preventDefault();
		const dt = e.clipboardData;
		if (!dt) return;
		// The data store is only readable during dispatch: start every read synchronously.
		const trusted = e.isTrusted;
		const types = [...dt.types];
		const data = types.filter((t) => t !== 'Files').map((type) => ({ type, text: dt.getData(type) }));
		const pending = [...dt.items].map(async (item): Promise<Entry> => {
			if (item.kind === 'string') {
				const text = await new Promise<string>((res) => item.getAsString(res));
				return { kind: item.kind, type: item.type, text };
			}
			const f = item.getAsFile();
			return { kind: item.kind, type: item.type, file: f && info(f) };
		});
		revoke();
		const files = [...dt.files].map(info);
		copied = null;
		result = { trusted, at: new Date(), types, entries: await Promise.all(pending), files, data };
		onresult();
	}
</script>

<svelte:document {onpaste} />

{#if shown && result}
	<div class="results">
		<p>
			isTrusted: <span class={result.trusted ? 'ok' : 'err'}>{result.trusted}</span>
		</p>

		<h3>types ({result.types.length})</h3>
		{#if result.types.length}
			<p class="mono">{result.types.join(', ')}</p>
		{:else}
			<p class="muted">none (empty clipboard)</p>
		{/if}

		<h3>items ({result.entries.length})</h3>
		{#if result.entries.length}
			<table>
				<thead>
					<tr><th>#</th><th>kind</th><th>type</th><th>content</th></tr>
				</thead>
				<tbody>
					{#each result.entries as en, i (i)}
						<tr>
							<td>{i}</td>
							<td>{en.kind}</td>
							<td><code>{en.type}</code></td>
							<td>
								{#if en.text !== undefined}
									<div class="muted">{en.text.length} chars</div>
									<pre>{clip(en.text)}</pre>
								{:else if en.file}
									<code>{en.file.name} · {en.file.type || '(no type)'} · {en.file.size} B · {en.file.modified}</code>
								{:else}
									<span class="muted">getAsFile() returned null</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<h3>files ({result.files.length})</h3>
		{#if result.files.length}
			<table>
				<thead>
					<tr><th>name</th><th>type</th><th>size</th><th>lastModified</th><th>preview</th></tr>
				</thead>
				<tbody>
					{#each result.files as f, i (i)}
						<tr>
							<td>{f.name}</td>
							<td><code>{f.type || '(no type)'}</code></td>
							<td>{f.size}</td>
							<td>{f.modified}</td>
							<td>
								{#if f.url}
									<img src={f.url} alt={f.name} style="max-width: 200px; max-height: 200px" />
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<h3>getData(type)</h3>
		{#each result.data as d (d.type)}
			<p class="mono" style="margin: 8px 0 4px">{d.type} · {d.text.length} chars</p>
			<pre>{clip(d.text)}</pre>
		{:else}
			<p class="muted">no string types</p>
		{/each}

		{#if transforms.length}
			<h3>transform ({transforms.length})</h3>
			{#each transforms as t (t.label)}
				<div class="row" style="margin-top: 12px">
					<span>{t.label}</span>
					<span class="muted mono">{t.out.map(([type]) => type).join(' + ')}</span>
					<button onclick={() => copy(t)}>Copy</button>
					{#if copied === t.label}<span class="ok">copied</span>{/if}
				</div>
				<pre>{clip(t.preview)}</pre>
			{/each}
		{/if}
	</div>
{/if}
