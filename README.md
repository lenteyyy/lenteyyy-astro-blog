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

本仓库独立维护个人博客，仅使用本站地址、giscus 和 Redis 统计配置。构建、路由、资源和浏览器存储均仅服务本站；页脚可通过普通外链访问学习站，不共享账号、服务、存储或数据迁移入口。

## 发布安全边界

发布前执行 `pnpm test`、`pnpm check`、`pnpm build`、`pnpm verify:build` 和 `pnpm security:audit`。构建已强制扫描公开产物；发布校验覆盖文章子目录，拒绝重复元数据、重复 slug 与符号链接。公开图片也会检查 EXIF、XMP、IPTC；原始附件与本地隔离文件不进入发布包。

`pnpm security:history` 在本机扫描 Git 所有可达历史文本对象，仅输出风险类别和文件位置，不输出匹配值；启发式扫描不能证明不存在未知格式的秘密。统计访问者标识使用按用途和日期隔离的 HMAC，并通过有限 TTL 自动过期；客户端按 UTC 日期去重，不持久保留原始 IP。私密统计变量仅配置于 Production，Preview 缺失配置时安全降级，不访问正式统计库。

设置本机 `BLOG_VERCEL_ACCOUNT_EMAIL` 后运行 `pnpm security:target`，核对当前登录账户、固定博客团队与项目、GitHub 仓库和生产分支。`BLOG_VERCEL_CLI` 可指定本机 CLI 路径。API 发布准备脚本会强制执行同一核对。

主站地址固定为 `https://www.lenteyyy.com`，评论固定使用本博客仓库。浏览量通过同源 POST 记录，GET 只读取统计；Redis 错误和超时不会阻塞文章阅读。自动 Git 部署关闭，手动发布时只操作博客项目。
