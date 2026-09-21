# Lenteyyy Blog 内容库

用 Obsidian 打开本目录。已发布文章放在 `posts/`；草稿放在 `drafts/`；原图放在 `_attachments/`。原图和 Obsidian 设置仅保存在本机，不进入 Git。

发布前把文章移到 `posts/`，将 `status` 改为 `published`，然后在项目根目录依次运行：

```sh
pnpm content:sync
pnpm content:validate
pnpm build
```

网站只发布 `public/media/` 中已压缩并清除 EXIF/GPS 的图片。
