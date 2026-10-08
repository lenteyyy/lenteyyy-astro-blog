import { skills, type Requirement } from './score-calculator.ts';
import { postgraduateRequirements } from './score-postgraduate.ts';
export type SchoolRequirement = Requirement & { id: string; group: string; label: string; source: string; note?: string };
const all = (minimum: number) => ({ listening: minimum, speaking: minimum, reading: minimum, writing: minimum });
const ucl = 'https://www.ucl.ac.uk/study/prospective-students/graduate/how-apply/english-language-requirements';
/** Score thresholds only. Specific degrees, test formats and validity must be checked at source. */
export const requirements: SchoolRequirement[] = [
	{ id: 'hku-ug', group: '香港', label: '香港大学 · 国际本科', overall: 6.5, minimums: { speaking: 6, writing: 6 }, source: 'https://www.admissions.hku.hk/apply/international-qualifications/english-language-requirement' },
	{ id: 'cuhk-ug', group: '香港', label: '香港中文大学 · 非联招本科', overall: 6, minimums: {}, source: 'https://admission.cuhk.edu.hk/application/non-jupas/language-requirements/' },
	{ id: 'hkust-ug', group: '香港', label: '香港科技大学 · 本科', overall: 6, minimums: {}, source: 'https://join.hkust.edu.hk/oas/elar.pdf' },
	{ id: 'nus-ug', group: '新加坡', label: '新加坡国立大学 · 国际本科', overall: 6.5, minimums: { reading: 6.5, writing: 6.5 }, source: 'https://www.nus.edu.sg/oam/docs/default-source/default-document-library/english-test-scores.pdf?sfvrsn=316d6c_6' },
	{ id: 'ntu-ug', group: '新加坡', label: '南洋理工大学 · 国际本科英语要求', overall: 6.5, minimums: { speaking: 6.5, writing: 6.5 }, source: 'https://www.ntu.edu.sg/admissions/undergraduate/admissions/general-admission-requirements' },
	{ id: 'smu-ug', group: '新加坡', label: '新加坡管理大学 · 国际本科（非法律）', overall: 7, minimums: { reading: 7, writing: 6.5 }, source: 'https://admissions.smu.edu.sg/admissions-requirements/international-and-other-qualifications' },
	{ id: 'smu-law', group: '新加坡', label: '新加坡管理大学 · 国际本科（法律）', overall: 7.5, minimums: { reading: 7, writing: 7 }, source: 'https://admissions.smu.edu.sg/admissions-requirements/international-and-other-qualifications' },
	{ id: 'oxford-ug', group: '英国罗素集团 · 示例', label: '牛津大学 · 本科', overall: 7.5, minimums: all(7), source: 'https://www.ox.ac.uk/admissions/undergraduate/applying/for-international-students/english-language-requirements-visas' },
	...[{ overall: 6.5, minimum: 6 }, { overall: 7, minimum: 6.5 }, { overall: 7, minimum: 7 }, { overall: 7.5, minimum: 7 }, { overall: 8, minimum: 8 }].map((item, index) => ({ id: `ucl-${index + 1}`, group: '英国罗素集团 · 示例', label: `UCL · 研究生 Level ${index + 1}`, overall: item.overall, minimums: all(item.minimum), source: ucl })),
	{ id: 'melbourne', group: '澳洲八大 · 示例', label: '墨尔本大学 · Level 1', overall: 6.5, minimums: all(6), source: 'https://study.unimelb.edu.au/how-to-apply/english-language-requirements' },
	{ id: 'sydney', group: '澳洲八大 · 示例', label: '悉尼大学 · 标准要求', overall: 6.5, minimums: all(6), source: 'https://www.sydney.edu.au/study/applying/how-to-apply/international-students/english-language-requirements.html' },
	{ id: 'monash', group: '澳洲八大 · 示例', label: '莫纳什大学 · 授课课程最低要求', overall: 6.5, minimums: all(6), source: 'https://www.monash.edu/admissions/entry-requirements/english-language' },
	{ id: 'unsw-engineering', group: '澳洲八大 · 示例', label: '新南威尔士大学 · 工程本科／授课研究生', overall: 6.5, minimums: all(6), source: 'https://www.unsw.edu.au/study/how-to-apply/english-language-requirements' },
	{ id: 'unsw-business', group: '澳洲八大 · 示例', label: '新南威尔士大学 · 商科本科／授课研究生', overall: 7, minimums: all(6), source: 'https://www.unsw.edu.au/study/how-to-apply/english-language-requirements' },
	{ id: 'uq', group: '澳洲八大 · 示例', label: '昆士兰大学 · 多数课程标准要求', overall: 6.5, minimums: all(6), source: 'https://study.uq.edu.au/admissions/english-language-requirements?studentType=international' },
	{ id: 'anu-crawford', group: '澳洲八大 · 示例', label: '澳洲国立大学 · Crawford 所列硕士课程', overall: 6.5, minimums: all(6), source: 'https://crawford.anu.edu.au/sites/default/files/2026-02/JJWBGSP%20info%20slides%20-%20Feb%202026.pdf' },
	{ id: 'uwa', group: '澳洲八大 · 示例', label: '西澳大学 · 标准要求', overall: 6.5, minimums: all(6), source: 'https://india.uwa.edu.au/english-language-requirements' },
	{ id: 'adelaide-linguistics', group: '澳洲八大 · 示例', label: '阿德莱德大学 · 语言学本科', overall: 6.5, minimums: all(6), source: 'https://adelaide.edu.au/study/degrees/bachelor-of-arts-linguistics-and-applied-linguistics/int/' },
];
export const requirementsCheckedAt = '2026-10-08';

export type RequirementGroup = Requirement & { id: string; group: string; label: string; members: SchoolRequirement[] };
// Merge only identical thresholds within a destination; retain exact course scopes.
export const groupedRequirements: RequirementGroup[] = [];
for (const item of requirements) {
	const group = item.group.startsWith('英国') ? '英国' : item.group.startsWith('澳洲') ? '澳大利亚' : item.group;
	const matching = groupedRequirements.find(entry => entry.group === group && entry.overall === item.overall && skills.every(key => entry.minimums[key] === item.minimums[key]));
	if (matching) matching.members.push(item);
	else groupedRequirements.push({ id: item.id, group, label: item.label, overall: item.overall, minimums: { ...item.minimums }, members: [item] });
}
for (const entry of groupedRequirements) {
	if (entry.members.length < 2) continue;
	entry.label = entry.group === '澳大利亚' ? '澳洲八大 · 所列课程' : entry.members.map(item => item.label.replace(' · ', '（') + '）').join('／');
}

export function groupProfiles(profiles: readonly SchoolRequirement[]): RequirementGroup[] {
	const result: RequirementGroup[] = [];
	for (const item of profiles) {
		const group = item.group.startsWith('英国') ? '英国' : item.group.startsWith('澳洲') ? '澳大利亚' : item.group;
		const matching = result.find(entry => entry.group === group && entry.overall === item.overall && skills.every(key => entry.minimums[key] === item.minimums[key]));
		if (matching) matching.members.push(item);
		else result.push({ id: item.id, group, label: item.label, overall: item.overall, minimums: { ...item.minimums }, members: [item] });
	}
	for (const entry of result) if (entry.members.length > 1) {
		const floors = skills.map(key => entry.minimums[key]);
		const minimum = floors.every(value => value !== undefined && value === floors[0]) ? `／单项${floors[0]?.toFixed(1)}` : floors.every(value => value === undefined) ? '' : '／单项要求见下方';
		const count = new Set(entry.members.map(item => item.label.split(' · ')[0])).size;
		entry.label = `${entry.group} · 总分${entry.overall.toFixed(1)}${minimum}（${count}所）`;
	}
	return result;
}
export const postgraduateGroups = groupProfiles(postgraduateRequirements);
export const undergraduateGroups = groupProfiles(requirements.filter(item => !item.id.startsWith('ucl-') && item.id !== 'anu-crawford'));
