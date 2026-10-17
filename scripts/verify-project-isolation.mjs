import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const foreignConfig = /lenteyielts|\/ielts(?:[/("']|$)|SUPABASE_|RESEND_/i;
const foreignRuntime = /lenteyielts\.cn|SUPABASE_|RESEND_|migration-bridge|lenteyielts-local-v1|OLD_ORIGIN/i;
const privateFile = /(?:^|\/)(?:\.env(?:\.|$)|auth\.json$|\.git(?:\/|$)|\.obsidian(?:\/|$))|\.(?:pem|key|map|log)$/i;
const foreignAsset = /(?:^|\/)(?:ielts-score-report|google-g)\./i;

// A user-approved, top-level outbound link is not a runtime integration.
// Mask only an actual href attribute on anchors in markup, never scripts,
// iframe URLs, data attributes or learning-site API/asset paths.
function withoutAllowedOutboundLinks(file, source) {
	if (!/\.(?:astro|html)$/i.test(file)) return source;
	const tokens = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-z][a-z0-9:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
	return source.replace(tokens, tag => /^<a\s/i.test(tag) ? tag.replace(
		/(^<a\s+href\s*=\s*)(["'])https:\/\/lenteyielts\.cn\/?\2(?=\s|\/?>)/i,
		'$1$2https://allowed-outbound.invalid/$2',
	) : tag);
}

function files(root, folder) {
	if (!fs.existsSync(path.join(root, folder))) return [];
	return fs.readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(entry => {
		const file = path.posix.join(folder, entry.name);
		if (entry.isSymbolicLink()) throw Error('Runtime symlink rejected: ' + file);
		return entry.isDirectory() ? files(root, file) : entry.isFile() ? [file] : [];
	});
}

export function verifyProjectIsolation(root = process.cwd()) {
	const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
	if (config.git?.deploymentEnabled !== false) throw Error('Automatic deployment must remain disabled');
	if (foreignConfig.test(JSON.stringify(config))) throw Error('Foreign project routing/configuration remains');
	for (const folder of ['src/pages/ielts', 'src/pages/api/ielts', 'public/ielts', 'infra', 'src/lib/ielts', 'src/components/ielts']) {
		if (fs.existsSync(path.join(root, folder))) throw Error('Foreign project files remain: ' + folder);
	}
	for (const file of [...files(root, 'src'), ...files(root, 'public')]) {
		if (privateFile.test(file) || foreignAsset.test(file)) throw Error('Private/foreign runtime file: ' + file);
		if (/\.(?:astro|tsx?|m?js|json|html|css|svg)$/.test(file)
			&& foreignRuntime.test(withoutAllowedOutboundLinks(file, fs.readFileSync(path.join(root, file), 'utf8')))) throw Error('Foreign project dependency: ' + file);
	}
	for (const file of files(root, 'dist/client')) {
		if (privateFile.test(file) || foreignAsset.test(file) || /(?:^|\/)ielts(?:\/|$)/i.test(file)) throw Error('Foreign/private public build file: ' + file);
		if (/\.(?:html|m?js|json|xml)$/.test(file)
			&& foreignRuntime.test(withoutAllowedOutboundLinks(file, fs.readFileSync(path.join(root, file), 'utf8')))) throw Error('Foreign dependency in public build: ' + file);
	}
	console.log('Blog isolation verified: own source, routes, assets, service configuration and public build.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) verifyProjectIsolation();
