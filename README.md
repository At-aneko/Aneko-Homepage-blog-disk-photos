# Aneko Homepage

Aneko Homepage 是参考zyyo主页风格，基于 Astro 7、Vue 3 和 Cloudflare Workers 构建的个人站点，包含主页、博客、相册、公开网盘和管理员邮箱。博客、相册、网盘和邮箱均可直接在网站中使用或管理，日常使用不需要手工调用接口或进入 Cloudflare 后台修改数据。

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
| 邮箱 | `/mail/` | 管理员登录后连接已有邮箱收发邮件 |

## 主要功能

- 博客：Markdown 正文、代码高亮、搜索、归档、标签、精选文章和草稿。
- 博客管理：新建、编辑、发布、删除、导入 Markdown、上传头图和附件。
- 相册：瀑布流、灯箱、原图查看与下载，以及照片上传、编辑、排序和删除。
- 网盘：目录浏览、文件预览与下载，以及文件上传、文件夹创建和递归删除。
- 邮箱：通过 IMAP 读取已有邮箱，通过 SMTP 发送邮件，并可通过受保护的 Webhook 套用模板发信。
- 统一登录：博客、相册、网盘和邮箱共用一个管理员访问码。
- Cloudflare 存储：R2 保存文件，KV 保存博客元数据、相册清单和加密的邮箱/Webhook 配置。

## 技术栈

- [Astro 7](https://astro.build/)：服务端路由、页面布局、Markdown 渲染和 Worker 输出。
- [Vue 3](https://vuejs.org/)：管理界面、主题、搜索、相册、网盘和邮箱交互。
- [Cloudflare Workers](https://workers.cloudflare.com/)：站点运行环境。
- [Cloudflare R2](https://developers.cloudflare.com/r2/)：博客正文与附件、相册原图和网盘文件。
- [Cloudflare KV](https://developers.cloudflare.com/kv/)：博客索引、文章元数据、相册清单和加密的邮箱连接凭据。
- [`cf-imap`](https://www.npmjs.com/package/cf-imap) 与 [`worker-mailer`](https://www.npmjs.com/package/worker-mailer)：在 Worker 中连接 IMAP 与 SMTP 服务。
- [`DOMPurify`](https://www.npmjs.com/package/dompurify)：净化隔离显示的邮件 HTML。
- [pnpm](https://pnpm.io/)：依赖和脚本管理。

## 网站内管理

博客、相册、网盘和邮箱共用 Worker secret `ACCESS_CODE`。它是网站管理员访问码，不是 Cloudflare API Token。

所有管理员登录在校验访问码前都会先通过 Cloudflare Turnstile。前端使用的 site key `0x4AAAAAAEMYXVJdgh9PVSLN` 是公开标识，可以出现在浏览器代码和仓库中；对应的 `TURNSTILE_SECRET` 只允许保存在 Cloudflare Worker 的加密 Secret 中，不能写入前端、配置文件或提交到仓库。

登录成功后，访问码只保存在当前标签页的 `sessionStorage` 中，服务端同时签发一个 12 小时有效的 `HttpOnly` 管理会话 Cookie。所有管理读取和写入都必须同时通过访问码与会话校验；退出时会清除两者。同一标签页切换到其他管理页面时通常不需要再次登录，关闭标签页后则需要重新输入访问码。

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
- 使用 Worker 动态生成的数据流固定测试 60 秒并显示下载速率，也可通过 `/api/drive/speed-test?duration=1800` 下载测速链接测试 1800 秒；修改 `duration` 参数即可设置测试秒数，不支持的值会回退为 60 秒（不占用 R2 存储）。
- 预览常见图片、视频、音频、PDF 和文本文件。
- 下载文件、删除文件或递归删除目录。

网盘目录直接来自 R2 的 `drive/` 前缀，不使用 KV。访客可以浏览和下载，只有管理员可以写入。同一路径上传同名文件会直接覆盖旧对象；删除文件和目录没有回收站，操作不可恢复。

### 邮箱

进入 [`/mail/`](https://www.aneko.ink/mail/)，使用管理员访问码登录后配置并连接一个已有邮箱账户。

- 收件仅支持使用 TLS 的 IMAP 连接，端口固定为 `993`。
- 发件仅支持使用 TLS 的 SMTP 连接，端口固定为 `465`。
- 邮件列表和正文从邮箱服务商按需读取，发送操作直接交给配置的 SMTP 服务。
- 邮件正文不会保存到 KV、R2 或其他本站存储；KV 只保存经过 AES-256-GCM 加密的 IMAP/SMTP 连接凭据、Webhook Token 和模板。
- 不创建或分配邮箱账户，不提供 POP3，也不使用 Webhook 接收邮件；Webhook 仅用于触发 SMTP 发信。
- 邮箱设置中的密码默认不回显；服务器和用户名不变时，留空会保留原密码；修改服务器或用户名时必须重新输入对应密码。同时清除 IMAP 与 SMTP 密码会停用已保存的邮箱连接。
- 发信使用请求幂等键和简单限流来降低误重复；Cloudflare KV 是最终一致性存储，因此这不是跨边缘并发下的严格一次投递保证。发送结果不确定时，应先检查邮箱服务商的已发送文件夹再重试。

邮箱页面是管理员专用 Webmail，不是临时邮箱服务。部署前必须确认邮箱服务商允许从 Cloudflare Workers 建立 IMAP/SMTP 连接。`MAIL_ALLOWED_HOSTS` 是可选的额外限制：留空时，管理员可以在网页中填写任意通过主机名语法与 Cloudflare Socket 出站限制的服务器；填写后只允许连接英文逗号分隔的准确主机名，不支持通配符、协议或端口。

邮箱实现使用 `cf-imap`、`worker-mailer` 和 `DOMPurify`。交互与 Worker 邮件能力受到 MIT 许可项目 [`dreamhunter2333/cloudflare_temp_email`](https://github.com/dreamhunter2333/cloudflare_temp_email) 的启发，但本项目只连接管理员已有邮箱，不包含临时邮箱地址创建或邮件托管能力。

#### Webhook 发信

在 `/mail/` 的邮箱设置中启用 Webhook，生成独立 Token，然后配置固定收件人、抄送、主题模板和正文模板。外部请求不能更改发件人或收件人，避免接口成为开放邮件中继。

请求地址：

```text
POST https://www.aneko.ink/api/mail/webhook
```

请求头：

```http
Authorization: Bearer <邮箱设置中保存的 Token>
Content-Type: application/json
Idempotency-Key: notification-20260813-0001
```

请求体可以是任意 JSON 对象，例如：

```json
{
  "event": "backup.completed",
  "timestamp": "2026-08-13T12:00:00.000Z",
  "title": "备份完成",
  "message": "2026-08-13 的站点备份已完成",
  "user": {
    "name": "Aneko"
  }
}
```

模板使用 `{{field}}` 读取字段，支持 `{{user.name}}` 这类嵌套路径。`{{json}}` 会插入完整的单行 JSON。时间应由调用方在请求体中传入，例如使用 `{{timestamp}}`；这样用同一请求体重试时模板结果保持稳定。找不到的字段会替换为空字符串。模板渲染后的主题和正文仍分别受 998 字符和 200,000 字符上限限制，超限请求会被拒绝。

`Idempotency-Key` 可选，但生产调用应为每个业务事件传入稳定且唯一的值，长度为 8–120 个字符：首字符必须是英文字母或数字，其余字符可使用英文字母、数字、点、下划线、冒号和连字符。使用同一幂等键重试同一内容时，服务端会返回已发送结果；同一键对应不同内容时返回 `409`。未传入时会为该次请求生成随机键，因此外部系统重试可能重复发信。

示例：

```bash
curl -X POST 'https://www.aneko.ink/api/mail/webhook' \
  -H 'Authorization: Bearer YOUR_WEBHOOK_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: notification-20260813-0001' \
  --data '{"event":"backup.completed","title":"Backup completed"}'
```

Webhook 复用邮箱发信的 IP 限流和 KV 幂等记录。Token 只在新建或轮换时显示，保存后仅返回“已配置”状态；如果 Token 泄露，请在邮箱设置中生成新 Token 并保存。

Webhook 不需要新增 Cloudflare Worker 变量或 Secret；它使用现有的 `MAIL_CONFIG_ENCRYPTION_KEY` 加密后单独存入 `ANEKO_KV` 的 `mail:webhook:v1`。邮箱连接配置和 Webhook 配置使用不同的 AES-GCM 附加认证数据，密文不能互换。

## Cloudflare 存储

### 绑定与变量

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `ASSETS` | Workers Assets binding | Astro 构建后的静态资源 |
| `ANEKO_R2` | R2 binding | 博客正文/附件、相册原图和网盘文件 |
| `ANEKO_KV` | KV binding | 博客元数据/索引、相册清单、加密的邮箱/Webhook 配置与发信状态 |
| `ACCESS_CODE` | Worker secret | 网站管理员访问码 |
| `TURNSTILE_SECRET` | Worker secret | Turnstile 服务端验证密钥，只能配置为加密 Secret |
| `TURNSTILE_HOSTNAMES` | Worker variable | Turnstile 允许的站点主机名，生产环境为 `www.aneko.ink` |
| `MAIL_CONFIG_ENCRYPTION_KEY` | Worker secret | 邮箱连接凭据与 Webhook 配置的 AES-256-GCM 加密密钥，只能配置为加密 Secret |
| `MAIL_CONFIG_KV_KEY` | Worker variable | 加密邮箱配置的 KV 键，默认 `mail:config:v2` |
| `MAIL_ALLOWED_HOSTS` | Worker variable | 可选的 IMAP/SMTP 主机名白名单；留空时只应用主机名校验和 Cloudflare 出站限制 |
| `BLOG_INDEX_KEY` | Worker variable | 博客索引键，默认 `blog:index` |
| `PHOTO_MANIFEST_KEY` | Worker variable | 相册清单键，默认 `photos` |
| `DRIVE_PREFIX` | Worker variable | 网盘对象前缀，默认 `drive/` |

当前生产环境的绑定目标如下；资源名称变更时，以 Cloudflare Worker 中的实际绑定为准。

| Binding | 当前生产资源 |
| --- | --- |
| `ANEKO_R2` | `aneko-homepage-blog-disk-photos-aneko-r2` |
| `ANEKO_KV` | `aneko-homepage-blog-disk-photos-aneko-kv` |

绑定名称和默认键定义在 `wrangler.jsonc` 与 `src/utils/cloudflare.ts`。`wrangler.jsonc` 只保存非敏感变量，不包含 `TURNSTILE_SECRET` 或 `MAIL_CONFIG_ENCRYPTION_KEY`。不要把 Cloudflare API Token、真实 `ACCESS_CODE`、真实 `TURNSTILE_SECRET`、真实 `MAIL_CONFIG_ENCRYPTION_KEY`、邮箱密码、R2 凭据或 KV 凭据提交到仓库。

### 数据位置

| 内容 | R2 object key | KV key |
| --- | --- | --- |
| 博客正文 | `blog/posts/<slug>.md` | `blog:post:<slug>` 和 `blog:index` |
| 博客图片/附件 | `blog/assets/<slug>/<unique-name>` | 无 |
| 相册原图 | `photos/<relative-path>` | `photos` |
| 网盘文件 | `drive/<relative-path>` | 无 |
| 网盘空目录标记 | `drive/<folder>/.keep` | 无 |
| 邮箱连接凭据 | 无 | `mail:config:v2`（可通过 `MAIL_CONFIG_KV_KEY` 修改） |
| Webhook Token、固定收件人与模板 | 无 | `mail:webhook:v1` |

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

### 邮箱与 Webhook 配置格式

邮箱连接配置写入 `ANEKO_KV` 的 `mail:config:v2` 键，或 `MAIL_CONFIG_KV_KEY` 指定的其他键；Webhook 配置固定写入独立的 `mail:webhook:v1` 键。两份 KV 数据都使用 `MAIL_CONFIG_ENCRYPTION_KEY` 进行 AES-256-GCM 加密，但使用不同的附加认证数据。邮箱密文包含 IMAP/SMTP 连接凭据；Webhook 密文包含 Token、启用状态、固定收件人和主题/正文模板。两者都不包含已收取或已发送的邮件正文。请通过 `/mail/` 的管理员界面更新配置，不要在 Dashboard 中手工拼接或修改密文。

`MAIL_CONFIG_ENCRYPTION_KEY` 必须表示恰好 32 字节：支持 64 位十六进制、解码后为 32 字节的 Base64/Base64URL，或恰好 32 字节的 UTF-8 原文。生产环境优先使用随机 32 字节的 Base64URL 值，并与 `ACCESS_CODE`、`TURNSTILE_SECRET` 分开管理。更换或丢失该 Secret 后，两份已有密文都将无法解密，需要在邮箱页面重新保存连接与 Webhook 配置。


## 部署

部署前需要在 Cloudflare Dashboard 中完成以下配置，不需要使用 Wrangler：

1. 打开 **Workers & Pages**，选择当前 Worker，然后进入 **Settings > Bindings**，将 R2 bucket 绑定为 `ANEKO_R2`，将 KV namespace 绑定为 `ANEKO_KV`。
2. 进入 **Settings > Variables and Secrets**，将管理员访问码添加为加密 Secret `ACCESS_CODE`。
3. 在同一页面将 Turnstile widget 的 secret key 添加为加密 Secret `TURNSTILE_SECRET`。不要使用公开 site key 代替，也不要把值写入仓库。
4. 在同一页面为邮箱连接与 Webhook 配置添加独立的加密 Secret `MAIL_CONFIG_ENCRYPTION_KEY`。优先使用随机 32 字节的 Base64URL 值，不要复用管理员访问码或提交到仓库。
5. 添加普通文本变量 `TURNSTILE_HOSTNAMES`，生产环境填写 `www.aneko.ink`。多个允许主机名使用英文逗号分隔。
6. 可选添加普通文本变量 `MAIL_ALLOWED_HOSTS`，将邮箱连接限制为指定的 IMAP 与 SMTP 主机名，例如 `imap.example.com,smtp.example.com`。只填写准确主机名，不包含协议或端口；留空时管理员可以直接在邮箱页面配置通过主机名校验和 Cloudflare Socket 出站限制的服务器。
7. 保留 `MAIL_CONFIG_KV_KEY=mail:config:v2`，或在尚未保存邮箱配置前按需修改。修改后原键中的配置不会自动迁移。
8. 保留或按需修改 `BLOG_INDEX_KEY`、`PHOTO_MANIFEST_KEY` 和 `DRIVE_PREFIX`，然后部署 Worker 使变量生效。
9. 在 **Settings > Domains & Routes** 中确认自定义域名 `www.aneko.ink` 已绑定到该 Worker。

Turnstile 的公开 site key 已直接集成在前端代码中，无需在 Worker 变量中重复配置。`wrangler.jsonc` 默认将 `MAIL_ALLOWED_HOSTS` 留空，便于管理员完全通过邮箱页面配置连接；需要固定邮箱服务商时，再在 Cloudflare 中填写精确白名单。仓库中的 `.dev.vars.example` 仅提供本地开发占位符；不要把生产 `TURNSTILE_SECRET`、`MAIL_CONFIG_ENCRYPTION_KEY` 或邮箱密码写入该示例文件。


## 项目结构

```text
src/
  components/       Vue 与 Astro UI 组件
  layouts/          页面布局
  pages/            页面和 Worker 内部路由
  plugins/          Markdown 插件
  styles/           全局样式
  utils/            鉴权、R2、KV、博客和邮箱工具
public/              静态资源
wrangler.jsonc       Cloudflare Worker 配置
```

## License

This project is released under the MIT License. See `LICENSE` for details.
