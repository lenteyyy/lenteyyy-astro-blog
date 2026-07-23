import OpenCC from 'opencc-js';

export type SiteLocale = 'zh-CN' | 'zh-TW';

const toTaiwanTraditional = OpenCC.Converter({ from: 'cn', to: 'twp' });
const taiwanTerms: Array<[string, string]> = [
	['回复', '回覆'],
	['回復', '回覆'],
	['博客', '部落格'],
	['搜索', '搜尋'],
	['搜寻', '搜尋'],
	['链接', '連結'],
	['视频', '影片'],
	['软件', '軟體'],
	['信息', '資訊'],
	['网络', '網路'],
	['评论区', '留言區'],
	['评论', '留言'],
	['登录', '登入'],
	['帐号', '帳號'],
	['账号', '帳號'],
	['程序', '程式'],
	['网页', '網頁'],
	['页面', '頁面'],
	['数据', '資料'],
	['设置', '設定'],
	['质量', '品質'],
];

export function translateText(value: string, locale: SiteLocale): string {
	if (locale !== 'zh-TW' || !value) return value;
	const converted = toTaiwanTraditional(value);
	return taiwanTerms.reduce((result, [from, to]) => result.replaceAll(from, to), converted);
}

export function localizedPath(path: string, locale: SiteLocale): string {
	return locale === 'zh-TW' ? `/zh-tw${path === '/' ? '' : path}` || '/zh-tw' : path;
}
