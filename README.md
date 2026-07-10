# Lenteyyy Astro Blog

这是 Lenteyyy 的 Astro + Notion Blog 第一版：Notion 负责写作，Astro 在构建时读取已发布文章并生成静态页面。

## 当前状态

网站已经包含首页、文章列表、分类筛选、文章详情和关于页。没有配置 Notion 环境变量时，项目会使用本地预览文章；配置完成后会切换到 Notion 数据库内容。

Notion 数据库已创建在博客主页下，名称是 `Astro Blog Posts`。网站查询使用它的 Data Source ID：`0e5369a4-53d1-455f-8e11-e1484822ee40`。只把 `Status` 设置为 `Published` 或 `已发布` 的文章发布到网站。

## 本地运行

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`.env` 需要填写：

```sh
NOTION_TOKEN=你的Notion内部集成密钥
NOTION_DATA_SOURCE_ID=0e5369a4-53d1-455f-8e11-e1484822ee40
PUBLIC_SITE_URL=https://你的域名
```

Notion 内部集成需要被邀请进 `Astro Blog Posts` 数据库，否则网站无法读取内容。`.env` 不要提交到 GitHub。

## 发布规则

在 Notion 数据库中填写 `Name`、`Slug`、`Date`、`Category`、`Tags`、`Status`、`Summary` 和 `Cover`。文章正文仍然写在数据库页面内部，图片和段落会在构建时读取。

```sh
pnpm build
```

生产构建输出在 `dist/`，之后可以连接 GitHub 部署到 Vercel 或 Cloudflare Pages。
