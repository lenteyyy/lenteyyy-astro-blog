# Lenteyyy Astro Blog

Astro + Notion 个人博客。Notion 是唯一内容后台；Astro 在构建时读取已发布文章，Vercel 托管页面和浏览量 API。

## 内容后台

发布数据库：`Astro Blog Posts`

网站读取 `NOTION_DATA_SOURCE_ID` 指向的 Notion data source。不要把普通 database ID 当作 data source ID 混用；新版 Notion API 已把 database 与 data source 拆开。

文章属性：

```txt
Name：标题
Slug：文章 URL，必须唯一
Date：发布日期
Category：分类
Tags：标签
Status：Published / 已发布 才会上线
Summary：摘要
Cover：封面 URL
Featured：可选，首页优先展示
```

正文写在数据库页面内部。取消 `Published` 后，文章不会进入首页、文章列表、标签页、RSS、Sitemap，也不会生成文章路由。

## 同步方式

当前是静态生成：Notion 修改后需要触发 Vercel 重新部署。

推荐做法：

1. 在 Vercel Project Settings 中创建 Deploy Hook。
2. 复制 hook URL。
3. 修改或新增 Notion 文章后，手动打开这个 URL，或后续用 Notion Webhook 调用它。

这样不会让每位访客访问页面时都请求 Notion API，速度更快，也更安全。

## 环境变量

```txt
NOTION_TOKEN
NOTION_DATA_SOURCE_ID
NOTION_DATABASE_ID
PUBLIC_SITE_URL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
PUBLIC_GISCUS_REPO
PUBLIC_GISCUS_REPO_ID
PUBLIC_GISCUS_CATEGORY
PUBLIC_GISCUS_CATEGORY_ID
```

`NOTION_DATABASE_ID` 只作为旧接口兼容兜底；正常使用 `NOTION_DATA_SOURCE_ID`。

## 评论

评论使用 giscus。需要在 GitHub 仓库开启 Discussions，然后到 https://giscus.app 选择：

```txt
Mapping: pathname
Theme: light/dark 自动
Reaction: enabled
Input position: bottom
```

把 giscus 生成的 repo、repoId、category、categoryId 填入 Vercel 环境变量。未配置时页面只显示安全占位，不会加载第三方脚本。

## 浏览量

公开文章浏览量使用 Upstash Redis REST API。

在 Vercel Marketplace 连接 Upstash Redis 后，填入：

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

接口只允许真实文章 slug，机器人和预取请求不会增加计数。Redis 缺失或失败时文章正文正常显示。

## 统计

项目已接入 Vercel Web Analytics 与 Speed Insights。需要在 Vercel 项目后台启用对应功能。

## 本地开发

```sh
npm install
cp .env.example .env
npm run dev
```

检查与构建：

```sh
npm run check
npm run lint
npm run build
```

本地没有 Notion 环境变量时会显示空文章状态；Vercel 生产环境缺少必要 Notion 变量会构建失败，避免悄悄发布错误内容。
