<svelte:head><title>How it works · Clipboard playground</title></svelte:head>

<article>
	<h1>How the browser sees your clipboard</h1>
	<p class="lede">
		A web page gets at the clipboard through several doors, and each is guarded differently. When
		“copying doesn’t work”, usually one door is shut while another is open. The playground tries
		them one at a time.
	</p>

	<h2>Clipboard events vs the async Clipboard API</h2>
	<p>
		<strong>Clipboard events</strong> (<code>copy</code>, <code>cut</code>, <code>paste</code>) fire when
		you press <kbd>⌘C</kbd> / <kbd>⌘V</kbd> (<kbd>Ctrl</kbd> on Windows and Linux) or pick an item from
		the browser’s own menu. On paste, <code>event.clipboardData</code> holds everything the system
		clipboard offers the page: plain text, HTML, files, and custom types written by other web pages.
		It is only readable while the event is being handled.
	</p>
	<p>
		The <strong>async Clipboard API</strong> (<code>navigator.clipboard</code>) can be called at any
		time, from any button. In exchange it is restricted: it needs a secure context (https or
		localhost) and a focused page, and <code>read()</code> returns only <code>text/plain</code>,
		<code>text/html</code> and <code>image/png</code>. It never returns files.
	</p>
	<p>
		That is why a “Paste” button can’t stand in for <kbd>⌘V</kbd>, and why the right-click menu here
		reads through the async API but asks you to press the shortcut for a real paste.
	</p>

	<h2>Permissions and focus</h2>
	<p>
		In Chromium, reading is behind the <code>clipboard-read</code> permission. The first
		<code>read()</code> shows a prompt in the address bar; a refusal sticks for the site until you
		reset it in the site settings. <code>navigator.permissions.query()</code> reports the state.
		Firefox and Safari don’t expose that permission name; they show a small Paste button next to the
		pointer that you have to click before a script can read.
	</p>
	<p>
		Every read also needs the document to have focus. With DevTools focused or the tab in the
		background, <code>read()</code> rejects with <code>NotAllowedError</code>.
	</p>

	<h2>Drag and drop: protected mode</h2>
	<p>
		While something is dragged over a page (<code>dragenter</code>, <code>dragover</code>), the
		<code>DataTransfer</code> is in protected mode: the page can see the list of types and each
		item’s kind, but <code>getData()</code> returns empty strings and file names stay hidden. The
		data unlocks only in the <code>drop</code> event, so a page can’t read what you merely drag
		across it.
	</p>
	<p>
		A page must cancel <code>dragover</code> to accept a drop at all; otherwise the browser opens the
		dropped file itself.
	</p>

	<h2>How a file shows up</h2>
	<p>
		A dropped or pasted file arrives as a <code>File</code>: name, size, a type guessed from the
		extension (often empty), and a modification date. A dropped folder also looks like a
		<code>File</code>, so the drop result asks two more questions of every item:
	</p>
	<ul>
		<li>
			<code>webkitGetAsEntry()</code> tells files from folders and can list a folder’s contents.
		</li>
		<li>
			<code>getAsFileSystemHandle()</code> (Chromium only) returns a handle the page can keep and
			later ask for write access.
		</li>
	</ul>
	<p>
		Files copied in Finder or Explorer reach the page only through a paste or a drop, and what
		arrives differs between browsers and systems. Compare the paste result across browsers when a
		client reports a problem.
	</p>

	<h2>Custom formats</h2>
	<p>
		In a <code>copy</code> event, <code>setData()</code> accepts any type, such as
		<code>application/json</code> or a made-up name. Chromium stores those types in one private
		clipboard entry: other web pages can read them on paste, native apps can’t. Firefox and Safari do
		the same in their own formats, and Safari only hands them to pages from the same site.
	</p>
	<p>
		The async API rejects arbitrary types. Chromium adds <em>web custom formats</em>: prefix the type
		with <code>web </code> (<code>web application/json</code>) and it is written as its own system
		clipboard format that native apps can learn to read. <code>ClipboardItem.supports()</code>
		tells you whether the browser accepts a given type.
	</p>

	<h2>Further reading</h2>
	<p>
		Alex Harri, <a href="https://alexharri.com/blog/clipboard"
			>The web’s clipboard, and how it stores data of different types</a
		>: how each browser maps these types onto the system clipboard.
	</p>
	<p>Agent-readable docs: <a href="/llms.txt">/llms.txt</a></p>
</article>

<style>
	article { max-width: 68ch; margin: 0 auto; padding: 48px 20px 120px; }
	h2 { font-size: 1.35rem; letter-spacing: -0.015em; margin: 48px 0 12px; }
	.lede { font-size: 1.1rem; color: var(--muted); margin: 20px 0 0; }
	p, li { line-height: 1.65; }
	ul { padding-left: 1.2em; margin: 0 0 12px; }
	li + li { margin-top: 6px; }
	code { font-size: 0.88em; }
</style>
