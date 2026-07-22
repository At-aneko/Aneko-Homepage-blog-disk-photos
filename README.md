# Aneko Homepage Astro + Vue

Aneko Homepage 是基于zyyo主页，使用 Astro 7、Vue 3 和 Cloudflare Workers 的个人站点。

## 技术栈

- Astro 7：服务端路由、页面布局、Markdown 渲染和 Worker 输出
- Vue 3：主题、搜索、相册灯箱、云盘文件管理等交互
- Cloudflare KV：博客索引/元数据与相册清单
- Cloudflare R2：博客 Markdown、博客附件、相册原图和云盘文件
- pnpm：依赖和脚本管理

## Cloudflare 存储规范

生产环境使用以下绑定。代码只通过 binding 访问资源；如果资源名称发生变化，以 Cloudflare Worker 中的实际绑定为准。

| Binding | 生产资源 | 用途 |
| --- | --- | --- |
| `ANEKO_R2` | R2 bucket `aneko-homepage-blog-disk-photos-aneko-r2` | 博客正文/附件、相册原图和网盘文件 |
| `ANEKO_KV` | KV namespace `aneko-homepage-blog-disk-photos-aneko-kv` | 博客元数据/索引和相册清单 |

对象和 KV 键的位置如下：

| 功能 | R2 object key | KV key |
| --- | --- | --- |
| 博客正文 | `blog/posts/<slug>.md` | `blog:post:<slug>` 和 `blog:index` |
| 博客图片/附件 | `blog/assets/<path>` | 无 |
| 相册原图 | `photos/<relative-path>` | `photos` |
| 网盘文件 | `drive/<relative-path>` | 无 |
| 网盘空目录标记 | `drive/<folder>/.keep` | 无 |

绑定名称、默认 KV 键和 R2 前缀定义在 `wrangler.jsonc` 与 `src/utils/cloudflare.ts`。路径统一使用 `/`，不能包含空路径段、`.` 或 `..`。

### 博客存储格式

正文上传到 R2 的 `blog/posts/<slug>.md`，只保存 Markdown 正文，不包含 YAML frontmatter。建议设置 Content-Type 为 `text/markdown; charset=utf-8`。

文章图片和附件上传到 `blog/assets/<path>`。页面中使用 `/api/blog/assets/<path>` 访问，例如：

```text
R2 object key: blog/assets/cloudflare-dl/cover.webp
页面 URL:      /api/blog/assets/cloudflare-dl/cover.webp
```

每篇文章必须把同一份元数据写入两个位置：

- `blog:post:<slug>`：值是单个文章元数据对象，供详情页读取。
- `blog:index`：值是所有文章元数据组成的数组，按 `pubDate` 从新到旧排列，供列表、归档、标签和搜索读取。

单篇文章元数据格式：

```json
{
  "slug": "my-post",
  "title": "文章标题",
  "description": "文章摘要",
  "pubDate": "2026-07-18T08:00:00.000Z",
  "updatedDate": "2026-07-19T08:00:00.000Z",
  "heroImage": "/api/blog/assets/my-post/cover.webp",
  "tags": ["Astro", "Cloudflare"],
  "author": "Aneko",
  "featured": false,
  "draft": false,
  "readingTime": 3,
  "bodyKey": "blog/posts/my-post.md"
}
```

`updatedDate` 和 `heroImage` 可以省略；其余字段应保留。`pubDate`/`updatedDate` 使用 ISO 8601，`readingTime` 是大于等于 1 的整数，`bodyKey` 必须指向对应的 R2 正文。`slug` 只能由字母、数字和连字符组成。

`blog:index` 的值示例：

```json
[
  {
    "slug": "my-post",
    "title": "文章标题",
    "description": "文章摘要",
    "pubDate": "2026-07-18T08:00:00.000Z",
    "tags": ["Astro", "Cloudflare"],
    "author": "Aneko",
    "featured": false,
    "draft": false,
    "readingTime": 3,
    "bodyKey": "blog/posts/my-post.md"
  }
]
```

网站管理界面会自动同步 R2 正文、`blog:post:<slug>` 和 `blog:index`，日常发布不需要手动修改 Cloudflare 数据。

### 相册存储格式

原图上传到 R2 的 `photos/<relative-path>`。KV 的 `photos` 键保存 JSON 数组，其中 `images` 必填，`title`、`date` 和 `description` 可选；`img` 只写相对于 `photos/` 的路径。

```text
R2 object key: photos/2026/summer-01.webp
页面 URL:      /api/photos/image/2026/summer-01.webp
KV 中的 img:   2026/summer-01.webp
```

```json
[
  {
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

### 网盘存储格式

文件上传到 `drive/<relative-path>`，页面通过列举 `drive/` 前缀实时生成目录和文件元数据；文件大小、上传时间和 ETag 均来自 R2。

空目录在 R2 中没有实体，因此创建目录时写入 `drive/<folder>/.keep` 作为占位对象。上传文件时应设置正确的 Content-Type，以便预览接口选择合适的响应类型。


## 网站内管理

博客、相册和网盘共用 Worker secret `ACCESS_CODE`。任意管理页面登录后，当前浏览器标签页会保持管理员状态，切换到其他管理页面不需要重复输入。

### 博客管理

进入 `/admin/blog/`，也可以从博客顶部的“管理”导航进入。

- 新建文章并填写标题、摘要、Slug、日期、作者和标签。
- 直接编辑 Markdown，或使用“导入正文”选择本地 `.md` 文件。
- 上传头图或附件；附件可以插入正文、复制链接或删除。
- 保存为草稿、发布、设为精选、编辑已有文章或删除文章。
- 删除文章时会同时清理正文和 `blog/assets/<slug>/` 下的附件。

### 相册管理

进入 `/photos/`，点击工具栏中的登录按钮。

- 选择多张图片批量上传，也可以把图片直接拖入页面。
- 登录后每张照片会显示编辑、前移、后移和删除按钮。
- 编辑标题、日期与描述后，页面会自动更新 KV 清单。
- 上传失败会回滚本批 R2 对象；删除时先更新清单，再清理原图。

### 网盘管理

进入 `/drive/`，点击工具栏中的登录按钮。

- 上传一个或多个文件，也可以拖放上传。
- 创建文件夹、进入目录、预览和下载文件。
- 删除单个文件或递归删除目录。
- 网盘目录直接来自 R2，不需要维护 KV 清单。

## 构建

```bash
pnpm build
```

构建产物由 `@astrojs/cloudflare` 输出到 `dist/`。项目包含 `deploy` 脚本，但仓库代码不会自动登录或部署 Cloudflare。

## License

This project is released under the MIT License. See `LICENSE` for details.
