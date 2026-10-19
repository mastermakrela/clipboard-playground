<script lang="ts">
	type Row = { id: number; item: number; type: string; size: number; text?: string; url?: string; err?: string };

	let { shown, onresult }: { shown: boolean; onresult: () => void } = $props();

	const fmt = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

	let env = $state<Record<string, boolean | string> | null>(null);
	let focused = $state(false);
	let perm = $state('checking…');
	let rows = $state.raw<Row[]>([]);
	let plain = $state<string | null>(null);
	let plainErr = $state('');
	let status = $state('');
	let reads = $state(0);
	let failures = $state(0);
	let lastError = $state('');
	let lastAt = $state<Date | null>(null);
	let busy = $state(false);
	let watch = $state(false);
	let rowId = 0;
	let urls: string[] = [];

	const hasChange = $derived(env?.change === true);

	function revoke() {
		for (const u of urls) URL.revokeObjectURL(u);
		urls = [];
	}

	export async function read() {
		if (busy) return;
		busy = true;
		onresult();
		status = 'Reading… (if nothing happens, look for a permission prompt in the address bar).';
		reads++;
		lastAt = new Date();
		const wasFocused = document.hasFocus();
		const next: Row[] = [];
		let failed = '';
		try {
			if (!navigator.clipboard?.read) throw new Error('navigator.clipboard.read is not available');
			const items = await navigator.clipboard.read();
			for (const [i, item] of items.entries()) {
				for (const type of item.types) {
					const row: Row = { id: rowId++, item: i, type, size: 0 };
					try {
						const blob = await item.getType(type);
						row.size = blob.size;
						if (type.startsWith('text/')) row.text = await blob.text();
						else if (type.startsWith('image/')) {
							row.url = URL.createObjectURL(blob);
							urls.push(row.url);
						}
					} catch (e) {
						row.err = fmt(e);
					}
					next.push(row);
				}
			}
			status = items.length
				? `Read ${items.length} item(s), ${next.length} type(s).`
				: 'Clipboard is empty, or holds nothing the async API exposes (only text/plain, text/html, image/png; files copied in Finder/Explorer usually are not).';
		} catch (e) {
			failed = fmt(e);
			const name = e instanceof Error ? e.name : '';
			status =
				name === 'NotAllowedError'
					? !wasFocused
						? 'Blocked: the document is not focused (click into the page first).'
						: perm === 'denied'
							? 'Blocked: clipboard-read permission is denied for this site.'
							: 'Blocked: permission prompt dismissed/denied, or the browser blocks reads without a user gesture.'
					: !navigator.clipboard?.read
						? 'Async Clipboard API read() is missing (insecure context or unsupported browser).'
						: 'Read failed, see error below.';
		}
		revoke();
		urls = next.flatMap((r) => (r.url ? [r.url] : []));
		rows = next;
		if (failed) {
			failures++;
			lastError = `${failed} (at ${lastAt.toLocaleTimeString()})`;
		}
		try {
			plain = await navigator.clipboard.readText();
			plainErr = '';
		} catch (e) {
			plain = null;
			plainErr = fmt(e);
		}
		busy = false;
	}

	$effect(() => {
		const c = navigator.clipboard;
		env = {
			secure: isSecureContext,
			'navigator.clipboard': !!c,
			'clipboard.read': !!c?.read,
			'clipboard.readText': !!c?.readText,
			ClipboardItem: typeof ClipboardItem !== 'undefined',
			'ClipboardItem.supports': typeof ClipboardItem !== 'undefined' && 'supports' in ClipboardItem,
			change: !!c && 'onclipboardchange' in c,
			ua: navigator.userAgent
		};
		focused = document.hasFocus();

		let ps: PermissionStatus | undefined;
		let dead = false;
		const sync = () => (perm = ps?.state ?? perm);
		navigator.permissions
			.query({ name: 'clipboard-read' as PermissionName })
			.then((s) => {
				if (dead) return;
				ps = s;
				sync();
				s.addEventListener('change', sync);
			})
			.catch(() => (perm = 'not queryable in this browser'));

		return () => {
			dead = true;
			ps?.removeEventListener('change', sync);
			revoke();
		};
	});

	$effect(() => {
		if (!watch || !env) return;
		const c = navigator.clipboard;
		if (hasChange) {
			c.addEventListener('clipboardchange', read);
			return () => c.removeEventListener('clipboardchange', read);
		}
		const tick = () => document.hasFocus() && read();
		window.addEventListener('focus', read);
		const id = setInterval(tick, 1500);
		return () => {
			window.removeEventListener('focus', read);
			clearInterval(id);
		};
	});
</script>

<svelte:window onfocus={() => (focused = true)} onblur={() => (focused = false)} />

<div class="dock">
	<button onclick={read} disabled={busy}>Read clipboard</button>
	<label title={hasChange ? 'clipboardchange event' : 'window focus + 1500 ms interval, only while focused'}>
		<input type="checkbox" role="switch" bind:checked={watch} /> Watch
	</label>
</div>

{#if shown && reads}
	<div class="results">
		<p>{status}</p>
		<p class="muted">
			Reads: {reads}, failed: {failures}, last read: {lastAt ? lastAt.toLocaleTimeString() : 'never'}
		</p>
		{#if lastError}
			<p class="err">Last error: {lastError}</p>
		{/if}

		{#if rows.length}
			<table>
				<thead>
					<tr><th>Item</th><th>Type</th><th>Bytes</th><th>Preview</th></tr>
				</thead>
				<tbody>
					{#each rows as r (r.id)}
						<tr>
							<td>{r.item}</td>
							<td><code>{r.type}</code></td>
							<td>{r.size}</td>
							<td>
								{#if r.err}
									<span class="err">{r.err}</span>
								{:else if r.text !== undefined}
									<pre>{r.text}</pre>
								{:else if r.url}
									<img src={r.url} alt={r.type} style="max-width: 200px; max-height: 200px" />
								{:else}
									<span class="muted">no preview</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if !busy}
			<h3>readText()</h3>
			{#if plainErr}
				<p class="err">{plainErr}</p>
			{:else if plain !== null}
				<pre>{plain}</pre>
				<p class="muted">{plain.length} chars</p>
			{/if}
		{/if}

		{#if env}
			<h3>Environment</h3>
			<table>
				<tbody>
					{#each Object.entries(env).filter(([k]) => k !== 'ua') as [k, v] (k)}
						<tr>
							<th>{k === 'change' ? "'onclipboardchange' in clipboard" : k === 'secure' ? 'isSecureContext' : k}</th>
							<td class={v ? 'ok' : 'err'}>{v}</td>
						</tr>
					{/each}
					<tr>
						<th>document.hasFocus()</th>
						<td class={focused ? 'ok' : 'err'}>{focused}</td>
					</tr>
					<tr>
						<th>permission clipboard-read</th>
						<td class={perm === 'granted' ? 'ok' : perm === 'denied' ? 'err' : 'muted'}>{perm}</td>
					</tr>
					<tr>
						<th>userAgent</th>
						<td><code>{env.ua}</code></td>
					</tr>
				</tbody>
			</table>
		{/if}
	</div>
{/if}

<style>
	.dock {
		position: fixed;
		left: 20px;
		bottom: 20px;
		z-index: 5;
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 6px 12px 6px 6px;
		font-size: 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.06);
	}
	.dock button { border-radius: 999px; }
	[role='switch'] {
		appearance: none;
		width: 30px;
		height: 18px;
		padding: 0;
		margin: 0;
		border-radius: 999px;
		background: var(--dash);
		position: relative;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	[role='switch']::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--bg);
		transition: translate 0.15s;
	}
	[role='switch']:checked { background: var(--accent); }
	[role='switch']:checked::after { translate: 12px; }
</style>
