import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const blogTarget = Object.freeze({
	projectId: 'prj_upWNHtI67HyLqMSy8b4etwk3IJoR',
	teamId: 'team_B4VArFpEujCGAKvklVk5ER7q',
	projectName: 'lenteyyy',
	repository: 'lenteyyy/lenteyyy-astro-blog',
});

export function assertTarget(link, remote) {
	if (link.projectId !== blogTarget.projectId || link.orgId !== blogTarget.teamId || link.projectName !== blogTarget.projectName) {
		throw Error('Deployment target does not match the independent blog');
	}
	if (!['https://github.com/lenteyyy/lenteyyy-astro-blog.git', 'git@github.com:lenteyyy/lenteyyy-astro-blog.git'].includes(remote.trim())) {
		throw Error('Git remote does not match the blog repository');
	}
}

export function assertRemoteIdentity(user, project, expectedEmail) {
	if (!expectedEmail || user.email !== expectedEmail || user.team?.id !== blogTarget.teamId) throw Error('Wrong Vercel account or team');
	if (project.id !== blogTarget.projectId || project.accountId !== blogTarget.teamId || project.name !== blogTarget.projectName
		|| project.link?.org !== 'lenteyyy' || project.link?.repo !== 'lenteyyy-astro-blog'
		|| project.link?.repoId !== 1296448006 || project.link?.productionBranch !== 'main') throw Error('Remote blog project/repository mismatch');
}

export function verifyDeploymentTarget(root = process.cwd(), online = false) {
	const link = JSON.parse(fs.readFileSync(path.join(root, '.vercel/project.json'), 'utf8'));
	const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: root, encoding: 'utf8' });
	assertTarget(link, remote);
	if (online) {
		const cli = process.env.BLOG_VERCEL_CLI || 'vercel';
		const read = args => JSON.parse(execFileSync(cli, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
		const user = read(['whoami', '--format', 'json', '--non-interactive']);
		const project = read(['api', `/v9/projects/${blogTarget.projectId}`, '--scope', blogTarget.teamId, '--raw']);
		assertRemoteIdentity(user, project, process.env.BLOG_VERCEL_ACCOUNT_EMAIL);
	}
	console.log(`Deployment target verified: ${blogTarget.repository}; ${blogTarget.projectName}; ${online ? 'account checked' : 'local link'}.`);
	return link;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) verifyDeploymentTarget(process.cwd(), process.argv.includes('--online'));
