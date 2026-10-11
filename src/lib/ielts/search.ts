export type StudySearchResult = { title: string; detail: string; section?: string; href?: string; materialId?: string };

const destinations = [
	{ title: '模考错题本', detail: '错题归档、错因分类与到期复习', href: '/ielts/mistakes', keywords: '模考 错题 错题本 复习 拼写 定位 同义替换 判断题' },
	{ title: '单词本', detail: '收藏、分组、释义与复习', href: '/ielts/wordbook', keywords: '其他 单词 词汇 单词本 生词 收藏 复习' },
	{ title: '打字速度练习', detail: '英语词汇与短文 · 速度与准确率', href: '/ielts/typing', keywords: '其他 打字 速度 键盘 输入 英语 词汇 短文 typing wpm' },
	{ title: '首页', detail: '个人简介与联系方式', section: 'overview', keywords: '简介 冷踢踢 老师 邮箱 Instagram' },
	{ title: '课程预约', detail: '选择日期与上课时间', section: 'booking', keywords: '预约 课程 时间 日期 取消 我的预约' },
	{ title: '学习资料', detail: '听力、阅读、写作、口语', section: 'materials', keywords: '学习 资料 下载 听力 阅读 写作 口语 词汇 语法 备考' },
	{ title: '模考页面', detail: '剑雅16–21 · Test 1–4', section: 'mock', keywords: '模考 剑雅 考试 练习 自选 仿真 listening reading writing test cambridge c16 c17 c18 c19 c20 c21' },
	{ title: '入学基础测试', detail: '听力、阅读、写作', href: '/ielts/entry-test', keywords: '入学 基础 测试 其他 听力 阅读 写作' },
	{ title: '单词听写', detail: '机经答案词 · 易错词 · 地图词 · Part 1 · 九分学长', href: '/ielts/dictation', keywords: '其他 单词 听写 词库 词书 机经 答案 易错 地图 航班 电话 号码 九分 学长 part 1 dictation' },
	{ title: 'IELTS分数计算器', detail: '总分、目标组合、院校门槛与单项评分', href: '/ielts/score-calculator', keywords: '其他 分数 计算 总分 评分 目标 港三所 罗素 澳洲 八大 香港 新加坡 澳大利亚 英国 calculator band score 写作 口语' },
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
