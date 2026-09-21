import path from 'node:path';

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
	for (const match of source.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) refs.add(path.basename(match[1].trim()));
	return [...refs];
}

export function titleFromFile(file) {
	return path.basename(file, path.extname(file));
}
