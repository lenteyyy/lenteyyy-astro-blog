export type StudySearchResult = { title: string; detail: string; section?: string; href?: string; materialId?: string };

const destinations = [
	{ title: '首页', detail: '个人简介与联系方式', section: 'overview', keywords: '简介 冷踢踢 老师 邮箱 Instagram' },
	{ title: '课程预约', detail: '选择日期与上课时间', section: 'booking', keywords: '预约 课程 时间 日期 取消 我的预约' },
	{ title: '学习资料', detail: '听力、阅读、写作、口语', section: 'materials', keywords: '学习 资料 下载 听力 阅读 写作 口语 词汇 语法 备考' },
	{ title: '模考页面', detail: '剑雅21 Test 1', section: 'mock', keywords: '模考 剑雅 考试 练习 listening reading writing test cambridge' },
	{ title: '入学基础测试', detail: '听力、阅读、写作', href: '/ielts/entry-test', keywords: '入学 基础 测试 其他 听力 阅读 写作' },
];

/** Local-only search: never index accounts, bookings, contact details or storage URLs. */
export function searchStudy(query: string, materials: Array<Record<string, unknown>> = [], authenticated = false): StudySearchResult[] {
	const terms = query.normalize('NFKC').trim().toLowerCase().slice(0, 100).split(/\s+/).filter(Boolean);
	const matches = (text: string) => terms.every(term => text.normalize('NFKC').toLowerCase().includes(term));
	const results: StudySearchResult[] = destinations.filter(item => matches(`${item.title} ${item.detail} ${item.keywords}`))
		.map(({ title, detail, section, href }) => ({ title, detail, section, href }));
	if (authenticated && terms.length) for (const item of materials) {
		const id = String(item.id || '');
		if (!/^[a-f0-9-]{36}$/i.test(id)) continue;
		const title = String(item.title || '未命名资料').slice(0, 120);
		const category = String(item.category || '').slice(0, 20);
		const description = String(item.description || '').slice(0, 300);
		if (matches(`${title} ${category} ${description}`)) results.push({ title, detail: category, section: 'materials', materialId: id });
		if (results.length >= 20) break;
	}
	return results.slice(0, 20);
}
