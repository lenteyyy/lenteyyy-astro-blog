# Lenteyyy Astro Blog

Astro + Obsidian 个人博客。文章和发布图片随 Git 保存，Vercel 负责网站、动态 OG 图、浏览量、统计与部署；生产构建不再访问 Notion。

## 写作与发布

用 Obsidian 打开项目里的 `content/` 目录。草稿放在 `content/drafts/`，完成后移到 `content/posts/`，并按 `content/templates/博客文章模板.md` 填写属性。图片直接粘贴到文章，Obsidian 会把原图存入本机 `content/_attachments/`。

发布前运行：

```sh
pnpm content:sync
pnpm content:validate
pnpm check
pnpm build
```

`content:sync` 会把正文引用的原图转换为 WebP、限制长边为 2400 像素并清除 EXIF/GPS，然后写入 `public/media/`。原图、草稿和 Obsidian 本机设置均被 Git 忽略。

文章属性：

```txt
title：标题
slug：唯一 URL 标识，只用小写英文、数字和连字符
date：发布日期，格式 YYYY-MM-DD
category：酒店测评 / 音乐推荐 / 个人杂谈 / 时尚议论
tags：标签列表
status：published 才会上线
summary：摘要
cover：封面，可用 Obsidian 图片链接
featured：首页优先展示
```

## 环境变量

```txt
PUBLIC_SITE_URL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
PUBLIC_GISCUS_REPO
PUBLIC_GISCUS_REPO_ID
PUBLIC_GISCUS_CATEGORY
PUBLIC_GISCUS_CATEGORY_ID
```

Notion 环境变量已经不再使用。

## 评论与浏览量

评论使用 giscus；未配置时只显示安全占位。浏览量使用 Upstash Redis REST API；接口只接受真实文章 slug，Redis 缺失或失败不会影响正文。Vercel Web Analytics 与 Speed Insights 需在项目后台启用。

## 本地开发

```sh
pnpm install
pnpm dev
```
