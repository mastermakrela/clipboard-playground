import { marked } from 'marked';

type Flavor = {
	bold: string;
	italic: string;
	strike: string;
	bullet: string;
	pipes: boolean;
	link: (text: string, href: string) => string;
	heading: (text: string, level: number) => string;
};

// readable and still auto-linked by Slack and mail clients; <url|text> only works through the API
const spelled = (t: string, h: string) => (t === h || h === `mailto:${t}` ? t : `${t} (${h})`);

const flavors = {
	markdown: {
		bold: '**',
		italic: '_',
		strike: '~~',
		bullet: '- ',
		pipes: true,
		link: (t, h) => (t === h ? `<${h}>` : `[${t}](${h})`),
		heading: (t, l) => `${'#'.repeat(l)} ${t}`
	},
	// what Slack's composer turns into formatting; it has no headings or link markup
	slack: { bold: '*', italic: '_', strike: '~', bullet: '• ', pipes: false, link: spelled, heading: (t) => `*${t}*` },
	plain: { bold: '', italic: '', strike: '', bullet: '• ', pipes: false, link: spelled, heading: (t) => t }
} satisfies Record<string, Flavor>;

export type Transform = { label: string; out: [type: string, value: string][]; preview: string };

const MARKDOWNISH = /^(#{1,6} |[-*+] |\d+\. |> |```)|\*\*\S|\[[^\]]+\]\([^)]+\)/m;

/** Conversions worth offering for what was pasted; each `out` is what Copy writes back. */
export function transformsFor(data: { type: string; text: string }[]): Transform[] {
	const get = (type: string) => data.find((d) => d.type === type)?.text;
	const html = get('text/html');
	const plain = get('text/plain');
	const json = data.find((d) => d.type === 'text/plain' || d.type.endsWith('json'))?.text;
	const list: Transform[] = [];
	if (html) {
		for (const [name, f] of Object.entries(flavors)) {
			const text = htmlTo(html, f);
			list.push({ label: `rich text → ${name}`, out: [['text/plain', text]], preview: text });
		}
	} else if (plain && MARKDOWNISH.test(plain)) {
		const rich = marked.parse(plain, { async: false });
		list.push({ label: 'markdown → rich text', out: [['text/plain', plain], ['text/html', rich]], preview: rich });
	}
	try {
		const pretty = json && /^\s*[[{]/.test(json) ? JSON.stringify(JSON.parse(json), null, 2) : null;
		if (pretty && pretty !== json) list.push({ label: 'JSON → pretty', out: [['text/plain', pretty]], preview: pretty });
	} catch {
		// not JSON after all: nothing to offer
	}
	return list;
}

const BLOCKS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DIV', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL']);
const isBlock = (n: Node | null) => n instanceof Element && BLOCKS.has(n.tagName);

/** Rich-text HTML (what apps put next to a lossy text/plain) → text in one flavor. */
function htmlTo(html: string, f: Flavor) {
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	return walk(body, f, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function walk(node: Node, f: Flavor, indent: string): string {
	if (node.nodeType === Node.TEXT_NODE) {
		const t = (node.textContent ?? '').replace(/\s+/g, ' ');
		// source-formatting whitespace between blocks would become stray line-leading spaces
		return t === ' ' && (isBlock(node.previousSibling) || isBlock(node.nextSibling)) ? '' : t;
	}
	if (!(node instanceof HTMLElement)) return '';
	const inner = () => [...node.childNodes].map((c) => walk(c, f, indent)).join('');
	// marks must hug the text: "** x **" is not bold in Markdown
	const wrap = (m: string) => inner().replace(/^(\s*)([^]*?)(\s*)$/, (_, a, t, b) => (t ? a + m + t + m + b : a + b));
	const tag = node.tagName;
	switch (tag) {
		case 'SCRIPT': case 'STYLE': case 'META': case 'TITLE': case 'HEAD':
			return '';
		case 'BR':
			return '\n' + indent;
		case 'HR':
			return '\n\n---\n\n';
		case 'B': case 'STRONG':
			return wrap(f.bold);
		case 'I': case 'EM':
			return wrap(f.italic);
		case 'S': case 'DEL': case 'STRIKE':
			return wrap(f.strike);
		case 'CODE':
			return '`' + node.textContent + '`';
		case 'PRE':
			return '\n\n```\n' + node.textContent?.replace(/\n$/, '') + '\n```\n\n';
		case 'A': {
			const href = node.getAttribute('href');
			const t = inner().trim();
			return href && !href.startsWith('#') ? f.link(t || href, href) : t;
		}
		case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
			return '\n\n' + f.heading(inner().trim(), Number(tag[1])) + '\n\n';
		case 'BLOCKQUOTE':
			return '\n\n' + inner().trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
		case 'UL': case 'OL': {
			const start = Number(node.getAttribute('start') ?? 1);
			const items = [...node.children].filter((li) => li.tagName === 'LI');
			return '\n' + items.map((li, i) => {
				const marker = tag === 'OL' ? `${start + i}. ` : f.bullet;
				const body = [...li.childNodes].map((c) => walk(c, f, indent + ' '.repeat(marker.length))).join('');
				return indent + marker + body.trim();
			}).join('\n') + '\n';
		}
		case 'TABLE': {
			const rows = [...node.querySelectorAll('tr')].map((tr) =>
				[...tr.children].map((c) => walk(c, f, '').replace(/\s+/g, ' ').trim())
			);
			if (!f.pipes) return '\n\n' + rows.map((r) => r.join('\t')).join('\n') + '\n\n';
			const line = (r: string[]) => `| ${r.map((c) => c.replaceAll('|', '\\|')).join(' | ')} |`;
			const rule = line(rows[0]?.map(() => '---') ?? []);
			return '\n\n' + rows.map((r, i) => (i === 1 ? rule + '\n' : '') + line(r)).join('\n') + (rows.length === 1 ? '\n' + rule : '') + '\n\n';
		}
		case 'P':
			return '\n\n' + inner().trim() + '\n\n';
		default:
			return isBlock(node) ? '\n' + inner().trim() + '\n' : inner();
	}
}
