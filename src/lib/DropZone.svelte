<script lang="ts">
	type Snap = {
		types: string[];
		effectAllowed: string;
		dropEffect: string;
		items: { kind: string; type: string }[];
		fileCount: number;
		data: { type: string; value: string }[];
	};
	type Row = {
		kind: string;
		type: string;
		string: string;
		entry: string;
		children: string[];
		handle: string;
	};
	type Drop = Snap & {
		isTrusted: boolean;
		files: File[];
		rows: Row[];
		previews: { name: string; url: string }[];
	};
	// not in lib.dom yet (Chromium only)
	type FsHandle = { kind: string; name: string };
	type ItemWithHandle = DataTransferItem & { getAsFileSystemHandle?: () => Promise<FsHandle | null> };

	let { shown, onresult }: { shown: boolean; onresult: () => void } = $props();
	let hover = $state.raw<Snap | null>(null);
	let drop = $state.raw<Drop | null>(null);
	let hoverKey = '';
	let cursor = $state({ x: 0, y: 0 });
	// demo policy: what a real app would accept; everything else gets the stop sign
	const accepts = (i: { kind: string; type: string }) => i.kind !== 'file' || /^(image\/|text\/|application\/pdf$)/.test(i.type);

	function snap(dt: DataTransfer): Snap {
		return {
			types: [...dt.types],
			effectAllowed: dt.effectAllowed,
			dropEffect: dt.dropEffect,
			items: [...dt.items].map((i) => ({ kind: i.kind, type: i.type })),
			fileCount: dt.files.length,
			data: [...dt.types].map((type) => ({ type, value: dt.getData(type) }))
		};
	}

	const editable = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

	// anywhere over the tab: preventDefault makes the whole page a drop target instead of opening the file.
	// dragover fires every few ms: only re-render when something visible changed
	function onwindowover(e: DragEvent) {
		if (editable(e.target)) return void (hover = null); // text fields keep their native drop
		e.preventDefault();
		cursor = { x: e.clientX, y: e.clientY };
		if (!e.dataTransfer) return;
		const key = [e.dataTransfer.types.join('|'), e.dataTransfer.effectAllowed, e.dataTransfer.dropEffect, e.dataTransfer.items.length].join(';');
		if (key === hoverKey) return;
		hoverKey = key;
		hover = snap(e.dataTransfer);
	}

	// relatedTarget is null when the drag leaves the window
	function onwindowleave(e: DragEvent) {
		if (e.relatedTarget) return;
		hover = null;
		hoverKey = '';
	}

	function readAll(reader: FileSystemDirectoryReader) {
		return new Promise<FileSystemEntry[]>((resolve, reject) => {
			const all: FileSystemEntry[] = [];
			const next = () =>
				reader.readEntries((batch) => {
					if (!batch.length) return resolve(all);
					all.push(...batch);
					next();
				}, reject);
			next();
		});
	}

	// DataTransferItem objects die after the handler returns: every sync API call
	// (webkitGetAsEntry, getAsFileSystemHandle, getAsString) happens before the first await.
	async function describe(item: DataTransferItem): Promise<Row> {
		const entry = item.webkitGetAsEntry?.() ?? null;
		const handleP = (item as ItemWithHandle).getAsFileSystemHandle?.();
		const stringP = item.kind === 'string' ? new Promise<string>((r) => item.getAsString(r)) : null;
		const row: Row = { kind: item.kind, type: item.type, string: '', entry: '', children: [], handle: '' };
		if (stringP) row.string = JSON.stringify(await stringP);
		if (entry) {
			row.entry = `${entry.isDirectory ? 'directory' : 'file'} ${entry.fullPath}`;
			if (entry.isDirectory) {
				try {
					const list = await readAll((entry as FileSystemDirectoryEntry).createReader());
					row.children = list.map((c) => `${c.isDirectory ? 'dir ' : 'file'} ${c.name}`);
				} catch (err) {
					row.children = [String(err)];
				}
			}
		}
		if (handleP) {
			try {
				const h = await handleP;
				row.handle = h ? `${h.kind} ${h.name}` : 'null';
			} catch (err) {
				row.handle = String(err);
			}
		}
		return row;
	}

	let urls: string[] = [];
	function revoke() {
		urls.forEach((u) => URL.revokeObjectURL(u));
		urls = [];
	}
	$effect(() => revoke);

	async function ondrop(e: DragEvent) {
		if (editable(e.target)) return;
		e.preventDefault();
		hover = null;
		hoverKey = '';
		const dt = e.dataTransfer;
		if (!dt) return;
		const isTrusted = e.isTrusted;
		const base = snap(dt);
		const files = [...dt.files];
		revoke();
		const previews = files
			.filter((f) => f.type.startsWith('image/'))
			.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
		urls = previews.map((p) => p.url);
		const rows = await Promise.all([...dt.items].map(describe));
		drop = { ...base, isTrusted, files, rows, previews };
		onresult();
	}

</script>

{#snippet snapView(s: Snap)}
	<table>
		<tbody>
			<tr><th>types</th><td class="mono">{JSON.stringify(s.types)}</td></tr>
			<tr><th>effectAllowed</th><td class="mono">{s.effectAllowed}</td></tr>
			<tr><th>dropEffect</th><td class="mono">{s.dropEffect}</td></tr>
			<tr><th>files.length</th><td class="mono">{s.fileCount}</td></tr>
		</tbody>
	</table>
	<table>
		<thead><tr><th>item kind</th><th>item type</th><th>getData(type)</th></tr></thead>
		<tbody>
			{#each s.items as item, i (i)}
				<tr>
					<td class="mono">{item.kind}</td>
					<td class="mono">{item.type || '(empty)'}</td>
					<td class="mono">{item.kind === 'string' ? JSON.stringify(s.data.find((d) => d.type === item.type)?.value ?? '') : '-'}</td>
				</tr>
			{:else}
				<tr><td colspan="3" class="muted">no items</td></tr>
			{/each}
			{#each s.data.filter((d) => !s.items.some((i) => i.type === d.type)) as d (d.type)}
				<tr><td class="muted">getData only</td><td class="mono">{d.type}</td><td class="mono">{JSON.stringify(d.value)}</td></tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<svelte:window ondragover={onwindowover} ondragleave={onwindowleave} {ondrop} />

{#if hover}
	<div class="tip mono" style="left: {cursor.x + 14}px; top: {cursor.y + 14}px" aria-hidden="true">
		{#each hover.items as item (item.kind + item.type)}
			<div>{accepts(item) ? '✓' : '🛑'} {item.kind} {item.type || '(no type)'}</div>
		{:else}
			<div>{hover.types.length} type(s), no items visible</div>
		{/each}
		<div class="muted">effectAllowed {hover.effectAllowed} · names, sizes and getData() stay hidden until drop</div>
		{#if !hover.items.every(accepts)}
			<div class="muted">a real app would set dropEffect = 'none' here</div>
		{/if}
	</div>
{/if}

	{#if shown && drop}
		<div class="results">
			<div class="row">
				<h3>drop</h3>
				<span class="mono {drop.isTrusted ? 'ok' : 'err'}">isTrusted: {drop.isTrusted}</span>
			</div>
			{@render snapView(drop)}

			<h3>files</h3>
			<table>
				<thead><tr><th>name</th><th>type</th><th>size</th><th>lastModified</th></tr></thead>
				<tbody>
					{#each drop.files as f, i (i)}
						<tr>
							<td class="mono">{f.name}</td>
							<td class="mono">{f.type || '(empty)'}</td>
							<td class="mono">{f.size}</td>
							<td class="mono">{new Date(f.lastModified).toISOString()}</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="muted">no files</td></tr>
					{/each}
				</tbody>
			</table>

			<h3>items</h3>
			<table>
				<thead><tr><th>kind / type</th><th>getAsString</th><th>webkitGetAsEntry</th><th>getAsFileSystemHandle</th></tr></thead>
				<tbody>
					{#each drop.rows as r, i (i)}
						<tr>
							<td class="mono">{r.kind} {r.type}</td>
							<td class="mono">{r.string || '-'}</td>
							<td class="mono">
								{r.entry || '-'}
								{#each r.children as c, j (j)}<div>{c}</div>{/each}
							</td>
							<td class="mono">{r.handle || '-'}</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="muted">no items</td></tr>
					{/each}
				</tbody>
			</table>

			{#each drop.previews as p (p.url)}
				<img src={p.url} alt={p.name} style="max-width: 100%; max-height: 240px; margin-top: 8px" />
			{/each}
		</div>
	{/if}

<style>
	.tip {
		position: fixed;
		z-index: 10;
		pointer-events: none;
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
	}
	.row h3 { margin: 0; }
	table + table { margin-top: 12px; }
</style>
