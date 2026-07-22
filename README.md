# Aneko Homepage

Aneko Homepage 是参考zyyo主页风格，基于 Astro 7、Vue 3 和 Cloudflare Workers 构建的个人站点，包含主页、博客、相册和公开网盘。博客、相册和网盘均可直接在网站中管理，日常使用不需要手工调用接口或进入 Cloudflare 后台修改数据。

- 演示站点：[www.aneko.ink](https://www.aneko.ink)
- 源码仓库：[At-aneko/Aneko-Homepage-blog-disk-photos](https://github.com/At-aneko/Aneko-Homepage-blog-disk-photos)

## 页面入口

| 页面 | 地址 | 访问权限 |
| --- | --- | --- |
| 主页 | `/` | 公开 |
| 博客 | `/blog/` | 公开，仅展示已发布文章 |
| 博客管理 | `/admin/blog/` | 登录后可写入 |
| 相册 | `/photos/` | 公开浏览，登录后可管理 |
| 网盘 | `/drive/` | 公开浏览和下载，登录后可管理 |

## 主要功能

- 博客：Markdown 正文、代码高亮、搜索、归档、标签、精选文章和草稿。
- 博客管理：新建、编辑、发布、删除、导入 Markdown、上传头图和附件。
- 相册：瀑布流、灯箱、原图查看与下载，以及照片上传、编辑、排序和删除。
- 网盘：目录浏览、文件预览与下载，以及文件上传、文件夹创建和递归删除。
- 统一登录：博客、相册和网盘共用一个管理员访问码。
- Cloudflare 存储：R2 保存文件，KV 保存博客元数据和相册清单。

## 技术栈

- [Astro 7](https://astro.build/)：服务端路由、页面布局、Markdown 渲染和 Worker 输出。
- [Vue 3](https://vuejs.org/)：管理界面、主题、搜索、相册和网盘交互。
- [Cloudflare Workers](https://workers.cloudflare.com/)：站点运行环境。
- [Cloudflare R2](https://developers.cloudflare.com/r2/)：博客正文与附件、相册原图和网盘文件。
- [Cloudflare KV](https://developers.cloudflare.com/kv/)：博客索引、文章元数据和相册清单。
- [pnpm](https://pnpm.io/)：依赖和脚本管理。

## 网站内管理

博客、相册和网盘共用 Worker secret `ACCESS_CODE`。它是网站管理员访问码，不是 Cloudflare API Token。

登录成功后，访问码只保存在当前标签页的 `sessionStorage` 中。同一标签页切换到其他管理页面时通常不需要再次登录；关闭标签页或点击退出后需要重新输入。服务端仍会校验每一次写操作。

### 博客管理

进入 [`/admin/blog/`](https://www.aneko.ink/admin/blog/)，也可以从博客顶部的“管理”导航进入。

- 新建文章并填写标题、摘要、Slug、发布日期、作者和标签。
- 直接编辑 Markdown，或从本地导入 `.md` 文件。
- 上传头图或附件，并将图片/附件链接插入正文。
- 保存为草稿、发布文章、设为精选或编辑已有文章。
- 删除文章时会同时删除 R2 正文、该文章目录下的附件、单篇 KV 元数据，并从博客索引中移除。

导入 Markdown 时会移除 YAML frontmatter，但不会用 frontmatter 自动填写表单；标题和 Slug 为空时会根据文件名生成。已有文章的 Slug 在编辑时锁定。删除单个附件后，如正文中已经使用该链接，需要同时修改正文。

点击保存后，网站会自动完成以下写入：

| 操作 | R2 | KV |
| --- | --- | --- |
| 保存或发布文章 | 写入 `blog/posts/<slug>.md` | 写入 `blog:post:<slug>`，并更新 `blog:index` |
| 保存草稿 | 写入正文 | 写入元数据和索引；公开页面会过滤草稿 |
| 上传头图或附件 | 写入 `blog/assets/<slug>/<unique-name>` | 不单独写入 KV |
| 删除文章 | 删除正文和 `blog/assets/<slug>/` | 删除单篇键并更新索引 |

### 相册管理

进入 [`/photos/`](https://www.aneko.ink/photos/)，点击工具栏中的登录按钮。

- 多选图片批量上传，或把图片拖入页面。
- 新照片的标题默认使用文件名，日期默认使用上传月份 `YYYY.MM`。
- 编辑标题、日期和描述。
- 将照片前移或后移，调整相册顺序。
- 删除照片时先更新 KV 清单，再清理不再被引用的 R2 原图。

上传时，原图会写入 `photos/<year>/<month>/<uuid>.<ext>`，随后自动更新 KV 的 `photos` 清单。若本批上传或清单保存失败，页面会尽力清理本批已经上传的 R2 对象。

### 网盘管理

进入 [`/drive/`](https://www.aneko.ink/drive/)，点击工具栏中的登录按钮。

- 上传一个或多个文件，也可以拖放上传。
- 创建文件夹、进入或返回目录。
- 预览常见图片、视频、音频、PDF 和文本文件。
- 下载文件、删除文件或递归删除目录。

网盘目录直接来自 R2 的 `drive/` 前缀，不使用 KV。访客可以浏览和下载，只有管理员可以写入。同一路径上传同名文件会直接覆盖旧对象；删除文件和目录没有回收站，操作不可恢复。

## Cloudflare 存储

### 绑定与变量

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `ASSETS` | Workers Assets binding | Astro 构建后的静态资源 |
| `ANEKO_R2` | R2 binding | 博客正文/附件、相册原图和网盘文件 |
| `ANEKO_KV` | KV binding | 博客元数据/索引和相册清单 |
| `ACCESS_CODE` | Worker secret | 网站管理员访问码 |
| `BLOG_INDEX_KEY` | Worker variable | 博客索引键，默认 `blog:index` |
| `PHOTO_MANIFEST_KEY` | Worker variable | 相册清单键，默认 `photos` |
| `DRIVE_PREFIX` | Worker variable | 网盘对象前缀，默认 `drive/` |

当前生产环境的绑定目标如下；资源名称变更时，以 Cloudflare Worker 中的实际绑定为准。

| Binding | 当前生产资源 |
| --- | --- |
| `ANEKO_R2` | `aneko-homepage-blog-disk-photos-aneko-r2` |
| `ANEKO_KV` | `aneko-homepage-blog-disk-photos-aneko-kv` |

绑定名称和默认键定义在 `wrangler.jsonc` 与 `src/utils/cloudflare.ts`。不要把 Cloudflare API Token、真实 `ACCESS_CODE`、R2 凭据或 KV 凭据提交到仓库。

### 数据位置

| 内容 | R2 object key | KV key |
| --- | --- | --- |
| 博客正文 | `blog/posts/<slug>.md` | `blog:post:<slug>` 和 `blog:index` |
| 博客图片/附件 | `blog/assets/<slug>/<unique-name>` | 无 |
| 相册原图 | `photos/<relative-path>` | `photos` |
| 网盘文件 | `drive/<relative-path>` | 无 |
| 网盘空目录标记 | `drive/<folder>/.keep` | 无 |

对象路径统一使用 `/`，不能包含空路径段、`.`、`..` 或 NUL。网页界面会自动生成符合要求的路径。

### 博客元数据格式

R2 中的 `blog/posts/<slug>.md` 只保存 Markdown 正文，不包含 YAML frontmatter，Content-Type 为 `text/markdown; charset=utf-8`。正文最大为 2 MiB。

每篇文章的元数据会同时写入 `blog:post:<slug>` 和 `blog:index`。单篇元数据格式如下：

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

- `updatedDate` 和 `heroImage` 可以省略。
- `pubDate` 和 `updatedDate` 使用 ISO 8601。
- `readingTime` 由服务端根据正文自动计算。
- `blog:index` 是上述元数据对象组成的数组，并按 `pubDate` 从新到旧排序。
- 草稿也保存在索引中，但不会出现在公开博客页面。
- Slug 支持 Unicode 字母、数字和连字符，不能以连字符开头或结尾，也不能使用连续连字符。
- `about`、`archive`、`assets`、`page` 和 `tag` 是保留 Slug。

文章附件的公开地址为 `/api/blog/assets/<slug>/<file>`。网页端使用唯一文件名，避免长期缓存导致同名覆盖后仍显示旧文件。

### 相册清单格式

相册原图位于 R2 的 `photos/<relative-path>`。KV 的 `photos` 键保存 JSON 数组，其中 `img` 只填写相对于 `photos/` 的路径：

```json
[
  {
    "title": "Summer",
    "date": "2026.07",
    "description": "夏日记录",
    "images": [
      { "img": "2026/07/example.webp" }
    ]
  }
]
```

`title`、`date` 和 `description` 可省略，`images` 为图片路径数组。网页新上传的每张照片会生成一个清单条目；兼容旧数据中的多图条目。编辑、排序和删除会覆盖整个 KV 清单，因此不建议在多个标签页中同时管理相册。

### 网盘对象格式

网盘文件直接写入 `drive/<relative-path>`。目录、文件大小、上传时间和 ETag 都从 R2 实时读取。

R2 本身没有空目录，因此创建文件夹时会写入 `drive/<folder>/.keep` 占位对象，列表中不会显示该对象。不要把真实文件命名为 `.keep`。


## 部署

部署前需要在 Cloudflare Worker 中完成以下配置：

1. 将 R2 bucket 绑定为 `ANEKO_R2`。
2. 将 KV namespace 绑定为 `ANEKO_KV`。
3. 将管理员访问码配置为 secret `ACCESS_CODE`。
4. 保留或按需修改 `BLOG_INDEX_KEY`、`PHOTO_MANIFEST_KEY` 和 `DRIVE_PREFIX`。
5. 将自定义域名绑定到 Worker。


## 项目结构

```text
src/
  components/       Vue 与 Astro UI 组件
  layouts/          页面布局
  pages/            页面和 Worker 内部路由
  plugins/          Markdown 插件
  styles/           全局样式
  utils/            鉴权、R2、KV 和博客工具
public/              静态资源
wrangler.jsonc       Cloudflare Worker 配置
```

## License

This project is released under the MIT License. See `LICENSE` for details.
