<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	let { children } = $props();

	const links = [
		{ href: '/', label: 'Clipboard playground' },
		{ href: '/write', label: 'Write' }
	];
</script>

<div class="app">
	<header class="bar">
		<nav>
			{#each links as l (l.href)}
				<a href={l.href} aria-current={page.url.pathname === l.href ? 'page' : undefined}>{l.label}</a>
			{/each}
		</nav>
		<a href="/about" aria-current={page.url.pathname === '/about' ? 'page' : undefined}>How it works</a>
	</header>
	{@render children()}
</div>

<style>
	.app { min-height: 100svh; display: grid; grid-template-rows: auto 1fr; }
	.bar { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 2px; font-size: 14px; }
	nav { display: flex; gap: 20px; }
	a { color: var(--muted); text-decoration: none; }
	a:hover, a[aria-current='page'] { color: var(--fg); }
</style>
