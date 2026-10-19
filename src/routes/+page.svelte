<script lang="ts">
	import ClipboardRead from '#lib/ClipboardRead.svelte';
	import PasteZone from '#lib/PasteZone.svelte';
	import DropZone from '#lib/DropZone.svelte';
	import Writer from '#lib/Writer.svelte';

	let reader: ClipboardRead;
	let writer = $state<Writer>();
	// one result at a time replaces the hero: whichever probe answered last
	let shown = $state<'read' | 'paste' | 'drop' | 'write' | null>(null);
	const labels = { read: 'navigator.clipboard.read()', paste: 'paste event', drop: 'drop event', write: 'write' };
	let dragging = $state(false);
	let menu = $state<{ x: number; y: number } | null>(null);
	let returnTo: HTMLElement | null = null;

	function oncontextmenu(e: MouseEvent) {
		// text fields keep the native menu: its Paste item is a real, trusted paste
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		e.preventDefault();
		returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		menu = { x: e.clientX, y: e.clientY };
	}

	function place(node: HTMLElement) {
		if (!menu) return;
		node.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - node.offsetWidth - 8))}px`;
		node.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - node.offsetHeight - 8))}px`;
		node.querySelector('button')?.focus();
	}

	function onmenukey(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		if (e.key === 'Escape') {
			menu = null;
			returnTo?.focus();
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const items = [...e.currentTarget.querySelectorAll('button')];
		const i = items.findIndex((b) => b === document.activeElement);
		items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
	}

	function act(fn: () => unknown) {
		menu = null;
		fn();
	}

	function onleave(e: DragEvent & { currentTarget: HTMLElement }) {
		if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
		dragging = false;
	}
</script>

<svelte:document
	{oncontextmenu}
	onpointerdown={(e) => menu && !(e.target instanceof Element && e.target.closest('.menu')) && (menu = null)}
/>

<svelte:head><title>Clipboard playground</title></svelte:head>

<section class="screen landing">
	<div
		class={['frame target', { active: dragging, filled: shown }]}
		role="region"
		aria-label="Paste or drop anywhere"
		ondragenter={() => (dragging = true)}
		ondragleave={onleave}
		ondrop={() => (dragging = false)}
	>
		{#if shown}
			<div class="head">
				<strong>{labels[shown]}</strong>
				<span class="muted">Paste, drop or right-click again to replace this.</span>
				<button onclick={() => (shown = null)}>Clear</button>
			</div>
		{:else}
			<div class="intro">
				<span class="mark" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
						<rect x="8" y="2" width="8" height="4" rx="1" />
						<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
					</svg>
				</span>
				<h1>Show me your clipboard.</h1>
				<p class="lede">
					Press <kbd>⌘V</kbd> or <kbd>Ctrl+V</kbd>, drop a file, or right-click for more.
				</p>
				<p class="calm">Nothing leaves your browser.</p>
				<!-- touch has no ⌘V: a native paste needs an editable to long-press -->
				<div
					class="touch"
					tabindex="0"
					role="textbox"
					aria-label="Paste target"
					contenteditable="true"
					onbeforeinput={(e) => e.preventDefault()}
				>
					Long-press here, then Paste
				</div>
			</div>
		{/if}
		<ClipboardRead bind:this={reader} shown={shown === 'read'} onresult={() => (shown = 'read')} />
		<PasteZone shown={shown === 'paste'} onresult={() => (shown = 'paste')} />
		<DropZone shown={shown === 'drop'} onresult={() => (shown = 'drop')} />
		<Writer bind:this={writer} shown={shown === 'write'} onresult={() => (shown = 'write')} />
	</div>
</section>

{#if menu}
	<div
		class="menu"
		role="menu"
		aria-label="Clipboard actions"
		tabindex="-1"
		{@attach place}
		onkeydown={onmenukey}
		onfocusout={(e) => !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) && (menu = null)}
	>
		<button role="menuitem" onclick={() => act(() => reader.read())}>
			Read via async Clipboard API
			<small>Asks permission. Text, HTML and PNG only.</small>
		</button>
		<hr />
		{#each writer?.actions ?? [] as a (a.label)}
			<button role="menuitem" onclick={() => act(a.run)}>
				{a.label}
				<small>{a.hint}</small>
			</button>
		{/each}
		<p>
			To paste, press <kbd>⌘V</kbd>. A menu item can only call the async API, which never hands over
			files or custom types.
		</p>
	</div>
{/if}

<style>
	.landing .frame { padding-bottom: 24px; }
	.landing .intro { align-self: center; max-width: 48rem; }
	.mark { display: inline-grid; place-items: center; width: 48px; height: 48px; margin-bottom: 24px; border: 1px solid var(--border); border-radius: 50%; background: var(--bg); }
	.calm { color: var(--muted); font-size: 14px; margin-top: 8px; }
	.landing .frame.filled { align-content: start; padding-top: 24px; padding-bottom: 96px; }
	.head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; width: 100%; max-width: 960px; }
	.head button { margin-left: auto; }
	.landing .frame.filled :global(.results) { margin-top: 16px; }
	.touch { display: none; margin: 20px auto 0; padding: 14px 18px; max-width: 18rem; border: 1px dashed var(--dash); border-radius: 10px; color: var(--muted); background: var(--bg); }
	.touch:focus { border-color: var(--accent); color: var(--accent); outline: none; }
	@media (pointer: coarse) {
		.touch { display: block; }
	}
	.menu hr { border: 0; border-top: 1px solid var(--border); margin: 4px 0; }

	.menu {
		position: fixed;
		z-index: 10;
		width: 18rem;
		padding: 4px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.06);
	}
	.menu button { display: block; width: 100%; text-align: left; border: 0; border-radius: 6px; padding: 8px 10px; }
	.menu button:hover, .menu button:focus-visible { background: var(--bg-soft); outline: none; }
	.menu button:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
	.menu small { display: block; color: var(--muted); font-size: 12px; }
	.menu p { margin: 4px 0 0; padding: 10px; border-top: 1px solid var(--border); font-size: 12.5px; line-height: 1.5; color: var(--muted); }
</style>
