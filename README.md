# Aneko Homepage Astro + Vue

Aneko Homepage 是基于zyyo主页，使用 Astro 7、Vue 3 和 Cloudflare Workers 的个人站点。

## 技术栈

- Astro 7：服务端路由、页面布局、Markdown 渲染和 Worker 输出
- Vue 3：主题、搜索、相册灯箱、云盘文件管理等交互
- Cloudflare KV：博客索引/元数据与相册清单
- Cloudflare R2：博客 Markdown、博客附件、相册原图和云盘文件
- pnpm：依赖和脚本管理

## 数据结构


```text
KV
├── blog:index                 # 全部文章元数据数组
├── blog:post:<slug>           # 单篇文章元数据
└── photos                     # 相册清单

R2
├── blog/posts/<slug>.md       # Markdown 正文，不含 frontmatter
├── blog/assets/**             # 文章图片和附件
├── photos/**                  # 相册原图
└── drive/**                   # 云盘目录与文件
```

绑定名称和默认键名位于 `wrangler.jsonc`。KV 与 R2 条目只声明 `binding`，可以在首次部署时由 Wrangler 自动配置，也可以补充已有资源的 `id` 和 `bucket_name`。

## 本地开发

```bash
pnpm install
pnpm dev
```

复制 `.dev.vars.example` 为 `.dev.vars`，并设置本地管理员访问码：

```dotenv
ACCESS_CODE=your-local-admin-code
```

本地 Worker 存储由 Cloudflare Vite 插件持久化。KV/R2 为空时，博客、相册和云盘会显示各自的空状态。

## 写入博客

使用管理员接口写入或更新文章。元数据会写入 KV，`body` 会写入 R2。

```http
PUT /api/admin/blog/my-post
X-Access-Code: <ACCESS_CODE>
Content-Type: application/json
```

```json
{
  "title": "文章标题",
  "description": "文章摘要",
  "pubDate": "2026-07-18T08:00:00.000Z",
  "updatedDate": "2026-07-18T08:00:00.000Z",
  "heroImage": "/api/blog/assets/cover.webp",
  "tags": ["Astro", "Cloudflare"],
  "author": "Aneko",
  "featured": true,
  "draft": false,
  "body": "## 正文\n\nMarkdown 内容"
}
```

删除文章：

```http
DELETE /api/admin/blog/my-post
X-Access-Code: <ACCESS_CODE>
```

文章附件使用 `/api/blog/assets/<path>` 的 `PUT`、`DELETE` 和公开 `GET` 接口。

## 相册清单

相册清单写入 KV 的 `photos` 键。图片路径相对于 R2 的 `photos/` 前缀：

```json
[
  {
    "id": "summer-2026",
    "title": "Summer",
    "date": "2026.07",
    "description": "夏日记录",
    "images": [
      { "img": "2026/summer-01.webp" },
      { "img": "2026/summer-02.webp" }
    ]
  }
]
```

- `GET /api/photos`：读取公开清单
- `PUT /api/photos`：使用 `X-Access-Code` 更新清单
- `GET /api/photos/image/<path>`：读取原图
- `PUT /api/photos/image/<path>`：使用 `X-Access-Code` 上传原图
- `DELETE /api/photos/image/<path>`：使用 `X-Access-Code` 删除原图

## 云盘接口

云盘页面位于 `/drive/`，文件统一存放在 R2 的 `drive/` 前缀。公开用户可以浏览、预览和下载；管理员登录后可以上传、创建文件夹和删除。

- `GET /api/drive/files?prefix=`：列出目录
- `POST /api/drive/files`：上传文件
- `DELETE /api/drive/files?key=`：删除文件或目录
- `POST /api/drive/folders`：创建文件夹
- `GET /api/drive/download?key=`：预览文件
- `GET /api/drive/download?key=&download`：下载文件
- `POST /api/drive/auth`：验证管理员访问码

## 构建

```bash
pnpm build
```

构建产物由 `@astrojs/cloudflare` 输出到 `dist/`。项目包含 `deploy` 脚本，但仓库代码不会自动登录或部署 Cloudflare。

## License

This project is released under the MIT License. See `LICENSE` for details.
