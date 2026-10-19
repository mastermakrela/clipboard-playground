<script lang="ts">
	import { copyViaEvent } from '#lib/copy.ts';

	let { shown, onresult }: { shown: boolean; onresult: () => void } = $props();

	let text = $state('Hello, world');
	let status = $state.raw<{ ok: boolean; msg: string } | null>(null);
	let caps = $state('');

	$effect(() => {
		(async () => {
			const parts = [
				`navigator.clipboard.writeText: ${'writeText' in (navigator.clipboard ?? {})}`,
				`navigator.clipboard.write: ${'write' in (navigator.clipboard ?? {})}`
			];
			try {
				const p = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
				parts.push(`permission clipboard-write: ${p.state}`);
			} catch (e) {
				parts.push(`permission clipboard-write: ${fmt(e)}`);
			}
			caps = parts.join('\n');
		})();
	});

	function fmt(e: unknown) {
		return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
	}

	async function run(label: string, fn: () => Promise<string | void>) {
		try {
			status = { ok: true, msg: `${label}: ${(await fn()) || 'written'}` };
		} catch (e) {
			status = { ok: false, msg: `${label}: ${fmt(e)}` };
		}
		onresult();
	}

	const blob = (data: string, type: string) => new Blob([data], { type });

	function png() {
		const c = document.createElement('canvas');
		c.width = 320;
		c.height = 80;
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('no 2d context');
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.fillStyle = '#1d1d1f';
		ctx.font = '20px sans-serif';
		ctx.fillText(text, 12, 46, c.width - 24);
		return new Promise<Blob>((resolve, reject) =>
			c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png')
		);
	}

	export function writeText() {
		return run('writeText', () => navigator.clipboard.writeText(text));
	}

	export function viaCopyEvent() {
		const { ok, trusted } = copyViaEvent([
			['text/plain', text],
			['text/html', `<b>${text}</b>`],
			['application/json', JSON.stringify({ text })],
			['x-playground/custom', text]
		]);
		status = {
			ok,
			msg: `copy event: isTrusted=${trusted}, execCommand returned ${ok}`
		};
		onresult();
	}

	// rendered by the page's right-click menu
	export const actions: { label: string; hint: string; run: () => unknown }[] = [
		{ label: 'writeText', hint: 'navigator.clipboard.writeText()', run: writeText },
		{
			label: 'write text + html',
			hint: 'ClipboardItem with two types',
			run: () =>
				run('write text + html', () =>
					navigator.clipboard.write([
						new ClipboardItem({ 'text/plain': blob(text, 'text/plain'), 'text/html': blob(`<b>${text}</b>`, 'text/html') })
					])
				)
		},
		{
			label: 'write png',
			hint: 'image/png from a canvas',
			run: () => run('write png', async () => navigator.clipboard.write([new ClipboardItem({ 'image/png': await png() })]))
		},
		{
			label: 'write application/json',
			hint: 'Rejected: not a mandatory type',
			run: () =>
				run('write application/json (async)', () =>
					navigator.clipboard.write([new ClipboardItem({ 'application/json': blob(JSON.stringify({ text }), 'application/json') })])
				)
		},
		{
			label: "write 'web application/json'",
			hint: 'Web Custom Format, Chromium only',
			run: () =>
				run("write 'web application/json' (async)", async () => {
					status = { ok: true, msg: 'web custom format: waiting for the clipboard permission prompt in the address bar…' };
					onresult();
					await navigator.clipboard.write([
						new ClipboardItem({ 'web application/json': blob(JSON.stringify({ text }), 'web application/json') })
					]);
					return `written (ClipboardItem.supports: ${ClipboardItem.supports?.('web application/json')})`;
				})
		},
		{ label: 'Copy via copy event', hint: 'Adds custom types only a paste can see', run: viaCopyEvent }
	];
</script>

{#if shown && status}
	<div class="results">
		<p class={['mono', status.ok ? 'ok' : 'err']}>{status.msg}</p>
		<p class="muted">
			Paste with <kbd>⌘V</kbd> to see what arrived. The copy event sets text/plain, text/html,
			application/json and x-playground/custom. Right-click to write again with this text:
		</p>
		<textarea rows="2" bind:value={text} aria-label="Text to write"></textarea>
		<pre>{caps}</pre>
	</div>
{/if}

<style>
	textarea { display: block; width: 100%; max-width: 28rem; margin-bottom: 12px; resize: vertical; }
</style>
