import path from 'node:path';
import { Marked } from 'marked';

export function splitFrontmatter(source) {
	const normalized = source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
	if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };
	const end = normalized.indexOf('\n---\n', 4);
	if (end < 0) throw new Error('Frontmatter is missing its closing ---');
	return { data: parseFrontmatter(normalized.slice(4, end)), body: normalized.slice(end + 5) };
}

export function parseFrontmatter(value) {
	const data = {};
	let listKey = '';
	for (const rawLine of value.split('\n')) {
		const list = rawLine.match(/^\s+-\s+(.*)$/);
		if (list && listKey) {
			data[listKey].push(parseScalar(list[1]));
			continue;
		}
		const field = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
		if (!field) continue;
		const [, key, raw = ''] = field;
		if (Object.hasOwn(data, key)) throw new Error(`Duplicate frontmatter field: ${key}`);
		if (!raw.trim()) {
			data[key] = [];
			listKey = key;
		} else {
			data[key] = parseScalar(raw);
			listKey = '';
		}
	}
	return data;
}

function parseScalar(raw) {
	const value = raw.trim();
	if (!value) return '';
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		try { return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1).replaceAll("''", "'"); } catch { return value.slice(1, -1); }
	}
	if (value === 'true') return true;
	if (value === 'false') return false;
	return value;
}

export function field(data, name, fallback = '') {
	const key = Object.keys(data).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
	return key ? data[key] : fallback;
}

export function serializePost(data, body) {
	const lines = ['---'];
	for (const [key, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${quote(item)}`);
		} else {
			lines.push(`${key}: ${typeof value === 'boolean' ? String(value) : quote(value)}`);
		}
	}
	lines.push('---', '', body.trim(), '');
	return lines.join('\n');
}

function quote(value) {
	const text = String(value ?? '');
	if (!text) return '""';
	if (/^[A-Za-z0-9_./-]+$/.test(text) || /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) return text;
	return JSON.stringify(text);
}

export function wikiReferences(source) {
	const refs = new Set();
	// Parse Markdown instead of rewriting raw text: code examples are not assets.
	const parser = new Marked({ extensions: [{
		name: 'wikiReference', level: 'inline',
		start(value) { return value.indexOf('![['); },
		tokenizer(value) {
			const match = /^!\[\[([^\]|#\n]+)(?:\|([^\]\n]*))?\]\]/.exec(value);
			if (match) return { type: 'wikiReference', raw: match[0], ref: match[1].trim() };
		},
	}] });
	parser.walkTokens(parser.lexer(source), token => { if (token.type === 'wikiReference') refs.add(token.ref); });
	return [...refs];
}

export function wikiReference(value) {
	const match = String(value || '').trim().match(/^!?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
	return match ? match[1].trim() : '';
}

export function titleFromFile(file) {
	return path.basename(file, path.extname(file));
}
