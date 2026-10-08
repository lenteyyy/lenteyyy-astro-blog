import type { SchoolRequirement } from './score-requirements.ts';
import type { Scores } from './score-calculator.ts';

export const rankingEdition = 'QS 2027';
export const rankingSource = 'https://www.topuniversities.com/qs-top-uni-wur';
// QS World University Rankings 2027, four destinations, rank <= 100.
export const universities = [
	['hku', '香港大学', '香港', 11], ['cuhk', '香港中文大学', '香港', 18],
	['hkust', '香港科技大学', '香港', 33], ['polyu', '香港理工大学', '香港', 50], ['cityu', '香港城市大学', '香港', 52],
	['nus', '新加坡国立大学', '新加坡', 10], ['ntu', '南洋理工大学', '新加坡', 12],
	['unsw', '新南威尔士大学', '澳大利亚', 19], ['melbourne', '墨尔本大学', '澳大利亚', 22],
	['sydney', '悉尼大学', '澳大利亚', 28], ['anu', '澳洲国立大学', '澳大利亚', 29],
	['monash', '莫纳什大学', '澳大利亚', 31], ['uq', '昆士兰大学', '澳大利亚', 40],
	['uwa', '西澳大学', '澳大利亚', 77], ['adelaide', '阿德莱德大学（Adelaide University）', '澳大利亚', 79], ['uts', '悉尼科技大学', '澳大利亚', 87],
	['imperial', '帝国理工学院', '英国', 2], ['oxford', '牛津大学', '英国', 4], ['cambridge', '剑桥大学', '英国', 6],
	['ucl', 'UCL', '英国', 8], ['edinburgh', '爱丁堡大学', '英国', 35], ['kcl', '伦敦国王学院', '英国', 37],
	['manchester', '曼彻斯特大学', '英国', 40], ['bristol', '布里斯托大学', '英国', 57], ['lse', '伦敦政治经济学院', '英国', 62],
	['warwick', '华威大学', '英国', 68], ['birmingham', '伯明翰大学', '英国', 68], ['leeds', '利兹大学', '英国', 77],
	['glasgow', '格拉斯哥大学', '英国', 80], ['sheffield', '谢菲尔德大学', '英国', 82], ['durham', '杜伦大学', '英国', 85], ['nottingham', '诺丁汉大学', '英国', 97],
] as const;
export type PostgraduateRequirement = SchoolRequirement & { university: typeof universities[number][0]; rank: number };
const all = (n: number): Scores => ({ listening: n, speaking: n, reading: n, writing: n });
function profile(university: PostgraduateRequirement['university'], code: string, scope: string, overall: number, minimums: Partial<Scores>, source: string, note?: string): PostgraduateRequirement {
	const school = universities.find(item => item[0] === university)!;
	return { id: `pg-${university}-${code}`, university, rank: school[3], group: school[2], label: `${school[1]} · ${scope}`, overall, minimums, source, ...(note ? { note } : {}) };
}
// These are published score profiles or named courses, not a universal requirement for every degree.
export const postgraduateRequirements: PostgraduateRequirement[] = [
	profile('hku', 'standard', '授课研究生基本要求', 6, all(5.5), 'https://portal.hku.hk/tpg-admissions/applying/admission-requirements'),
	profile('hku', 'arts', '文学院授课研究生（佛学研究中心除外）', 7, all(5.5), 'https://portal.hku.hk/tpg-admissions/applying/admission-requirements'),
	profile('cuhk', 'standard', '研究生基本要求', 6.5, {}, 'https://www.gs.cuhk.edu.hk/admissions/requirements'),
	profile('hkust', 'materials', '材料工程硕士（2027/28）', 6.5, all(5.5), 'https://prog-crs.hkust.edu.hk/pgprog/2027-28/msc-mate'),
	profile('polyu', 'standard', '授课研究生基本要求', 6, {}, 'https://www.polyu.edu.hk/study/pg/taught-postgraduate/admission-requirements-tpg'),
	profile('cityu', 'standard', '授课研究生基本要求', 6, {}, 'https://www.cityu.edu.hk/pg/taught-postgraduate-programmes/entrance-requirements', '总分6.0须通过英语面试；专业可另设更高要求'),
	profile('nus', 'electrical', '电气工程硕士', 6, {}, 'https://cde.nus.edu.sg/ece/graduate/msc-electrical-engineering/admission-requirements/'),
	profile('ntu', 'computing', '计算机学院理学硕士', 6.5, {}, 'https://www.ntu.edu.sg/computing/admissions/graduate-programmes/master-of-science-programmes/frequently-asked-questions'),
	profile('unsw', 'engineering', '工程授课研究生', 6.5, all(6), 'https://www.unsw.edu.au/study/how-to-apply/english-language-requirements'),
	profile('unsw', 'business', '商科授课研究生', 7, all(6), 'https://www.unsw.edu.au/study/how-to-apply/english-language-requirements'),
	profile('melbourne', 'level1', '研究生 Level 1', 6.5, all(6), 'https://study.unimelb.edu.au/how-to-apply/english-language-requirements'),
	profile('sydney', 'standard', '研究生标准要求', 6.5, all(6), 'https://www.sydney.edu.au/study/applying/how-to-apply/international-students/english-language-requirements.html'),
	profile('anu', 'crawford', 'Crawford 所列硕士课程', 6.5, all(6), 'https://crawford.anu.edu.au/sites/default/files/2026-02/JJWBGSP%20info%20slides%20-%20Feb%202026.pdf'),
	profile('monash', 'coursework', '授课研究生最低要求', 6.5, all(6), 'https://www.monash.edu/admissions/entry-requirements/english-language'),
	profile('uq', 'standard', '多数研究生课程标准要求', 6.5, all(6), 'https://study.uq.edu.au/admissions/english-language-requirements?studentType=international'),
	profile('uwa', 'standard', '研究生标准要求', 6.5, all(6), 'https://www.uwa.edu.au/study/how-to-apply/pathways-and-eligibility/english-language-requirements'),
	profile('adelaide', 'biopharmaceutical', '生物制药工程硕士', 6.5, all(6), 'https://adelaide.edu.au/study/degrees/master-of-engineering-biopharmaceutical/'),
	profile('uts', 'standard', '多数授课研究生课程', 6.5, { writing: 6 }, 'https://www.uts.edu.au/for-students/admissions-entry/eligibility/english-language-requirements'),
	profile('imperial', 'standard', '研究生 Standard', 6.5, all(6), 'https://www.imperial.ac.uk/study/apply/english-language/'),
	profile('imperial', 'higher', '研究生 Higher', 7, all(6.5), 'https://www.imperial.ac.uk/study/apply/english-language/'),
	profile('oxford', 'standard', '研究生 Standard', 7, all(6.5), 'https://www.ox.ac.uk/admissions/graduate/application-guide/qualifications-experience-languages-funding/english-language-proficiency'),
	profile('oxford', 'higher', '研究生 Higher', 7.5, all(7), 'https://www.ox.ac.uk/admissions/graduate/application-guide/qualifications-experience-languages-funding/english-language-proficiency'),
	profile('cambridge', 'computer', '高级计算机科学 MPhil（2027入学）', 7.5, all(7), 'https://www.postgraduate.study.cam.ac.uk/courses/directory/cscsmpacs/requirements'),
	...[{ overall: 6.5, minimum: 6 }, { overall: 7, minimum: 6.5 }, { overall: 7, minimum: 7 }, { overall: 7.5, minimum: 7 }, { overall: 8, minimum: 8 }].map((item, i) => profile('ucl', `level${i + 1}`, `研究生 Level ${i + 1}`, item.overall, all(item.minimum), 'https://www.ucl.ac.uk/study/prospective-students/graduate/how-apply/english-language-requirements')),
	profile('edinburgh', 'operational', '运筹学硕士', 6.5, all(6), 'https://study.ed.ac.uk/programmes/postgraduate-taught/116-operational-research'),
	profile('kcl', 'd', '研究生 Band D（自然科学等所列课程）', 6.5, all(6), 'https://www.kcl.ac.uk/study/postgraduate-taught/how-to-apply/entry-requirements/english-language-requirements'),
	profile('manchester', 'computing', '高级计算机科学硕士（2027入学）', 7, all(6.5), 'https://www.manchester.ac.uk/study/masters/courses/list/21573/msc-advanced-computer-science/'),
	profile('bristol', 'e', '研究生 Profile E', 6.5, all(6), 'https://www.bristol.ac.uk/study/language-requirements/profile-e/'),
	profile('lse', 'standard', '研究生 Standard', 7, all(6.5), 'https://www.lse.ac.uk/study-at-lse/Graduate/Prospective-students/Entry-requirements/English-language-requirements'),
	profile('warwick', 'wmg', 'WMG硕士直接入学', 6.5, all(6), 'https://warwick.ac.uk/fac/sci/wmg/study/masters-degrees/how-to-apply/english/'),
	profile('birmingham', 'science', '科学类研究生基本要求', 6, all(5.5), 'https://www.birmingham.ac.uk/study/postgraduate/taught/apply/international-entry-requirements'),
	profile('birmingham', 'engineering', '工程／计算机等所列研究生课程', 6.5, all(6), 'https://www.birmingham.ac.uk/study/postgraduate/taught/apply/international-entry-requirements'),
	profile('leeds', 'business', '商学院硕士', 6.5, all(6), 'https://business.leeds.ac.uk/masters/doc/english-language-requirements-2/page/1'),
	profile('glasgow', 'computing-writing', '计算机科学硕士 · 写作路径', 6.5, { ...all(6), writing: 6.5 }, 'https://www.gla.ac.uk/postgraduate/taught/computingscience/', '与听说读路径满足其一即可'),
	profile('glasgow', 'computing-other', '计算机科学硕士 · 听说读路径', 6.5, { ...all(6.5), writing: 6 }, 'https://www.gla.ac.uk/postgraduate/taught/computingscience/', '与写作路径满足其一即可'),
	...[{ name: 'Standard', overall: 6.5, minimum: 6 }, { name: 'Good', overall: 7, minimum: 6.5 }, { name: 'Advanced', overall: 7.5, minimum: 7 }, { name: 'Proficiency', overall: 8, minimum: 7.5 }].map(item => profile('sheffield', item.name.toLowerCase(), `研究生 ${item.name}`, item.overall, all(item.minimum), 'https://sheffield.ac.uk/postgraduate/english-language')),
	profile('durham', 'a', '研究生 Direct Entry Band A', 7, all(6.5), 'https://dur.ac.uk/study/international/entry-requirements/english-language-requirements/direct-entry-band-a/'),
	// UCAS displays the university-supplied 2027 course entry; the university page blocks automated readers.
	profile('nottingham', 'international-relations', '国际关系硕士（2027入学）', 6.5, all(6), 'https://www.ucas.com/explore/courses/fea3783d-444a-fa61-e1b7-bb9911575d06/course'),
];
