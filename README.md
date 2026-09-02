# YHG ESPORTS

YHG 电子竞技战队官方展示站 —— 王者荣耀分部，以"野火精神"为核心文化，汇聚怀揣竞技理想的青年选手，持续向更高赛场发起冲击。

- 在线访问：<https://yhg.whitemoon319.xyz>
- 代码仓库：<https://github.com/WhiteMoon319/YHG-web>
- 生产分支：`main`（Cloudflare Pages 自动/手动部署均指向该分支）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML5 · CSS3 · JavaScript（零构建流程） |
| 后端 | Cloudflare Pages Functions（`functions/` 目录） |
| 数据库 | Cloudflare D1（SQLite，绑定名 `DB`，库 `yhg-db`） |
| 邮件 | nodemailer（QQ SMTP，用于注册/重置密码验证码） |
| 部署 | Cloudflare Pages（自定义域名 `yhg.whitemoon319.xyz`） |

## 功能模块

- **认证体系**：注册（邮箱验证码）、登录/登出、会话 7 天有效期、重置密码
- **用户中心**：`dashboard/`（个人面板）、`profile.html`（动态资料页）
- **选手系统**：阵容展示、选手详情（`members/[name]/`）、多选手绑定（`player_bindings`）、资料编辑权限（`player_slug` 或 `bound_players` 命中其一即可编辑）
- **管理员后台**：`admin/`，覆盖用户管理（含选手绑定）、新闻/公告/赛事管理、初始化脚本
- **新闻互动**：文章详情、评论（嵌套回复）、评论点赞、文章点赞
- **私信与通知**：`messages/`（站内私信）、`notifications/`（站内通知，含未读数）
- **汉堡菜单**：移动端导航收纳（登录/注册入口收进菜单）

## 页面导览

| 路径 | 内容 |
|---|---|
| `/` | 首页（野火精神、快速入口、战队关键词） |
| `about/` | 战队介绍：文化、专业体系、野火精神、竞技理念 |
| `members/` | 队员阵容一览与选手详情 |
| `matches/` | 赛事赛程记录 |
| `news/` | 战队新闻列表、文章详情、评论 |
| `login/` / `register/` / `forgot-password/` | 登录 / 注册 / 重置密码 |
| `dashboard/` | 个人面板 |
| `admin/` | 管理员后台 |
| `messages/` / `notifications/` | 私信 / 通知 |

## 目录结构

```
.
├── index.html                     # 首页
├── about/                         # 关于 YHG
├── members/                       # 选手详情页（含 profile.html 动态资料页、edit.html 编辑页）
├── matches/                       # 赛事赛程
├── news/                          # 新闻列表 / articles（旧版文章壳，重定向到 article.html）
├── login/ register/               # 登录 / 注册
├── forgot-password/               # 重置密码
├── dashboard/                     # 用户面板
├── admin/                         # 管理员后台
├── messages/ notifications/       # 私信 / 通知
├── functions/                     # Cloudflare Pages Functions（后端 API）
│   ├── _middleware.js             # 全局安全响应头 + 敏感路径拦截（403）
│   ├── _private/                  # 后端内部工具（不入库部署）
│   └── api/                       # REST 端点（auth / admin / news / players / matches / messages / notifications）
├── resource/
│   ├── css/style.css              # 全站唯一样式（style.min.css 已废弃）
│   ├── js/                        # 页面逻辑（main.js 公共工具 + 各页面脚本）
│   └── img/                       # Logo、选手照片
├── _private/                      # 本地脚本与数据库 schema（被 middleware 拦截，不公开）
├── sw.js                          # Service Worker（stale-while-revalidate 缓存策略）
├── robots.txt  sitemap.xml        # SEO
└── wrangler.jsonc                 # Cloudflare Pages + D1 配置
```

## 数据库

D1 库 `yhg-db`，schema 见 `_private/db_schema.sql`。核心表：

- `users` / `sessions`（会话，含过期时间）
- `verification_codes`（注册/重置验证码，限次校验）
- `players` / `player_bindings`（选手资料与用户绑定）
- `news_articles` / `comments` / `article_likes` / `comment_likes`
- `messages` / `notifications`
- `rate_limits`（按 IP 或自定义 key 的频率限制）

## 本地运行

```bash
npx wrangler pages dev .      # 推荐：同时启用 Functions 与 D1 绑定
```

或仅静态预览（无后端功能）：

```bash
python -m http.server 8000
```

访问 `http://localhost:8000/`。登录、注册、评论等依赖 `functions/` 的功能需用 wrangler 方式运行。

## 部署

生产环境为 Cloudflare Pages 项目 `yhg`（生产分支 `main`）。推送 `main` 后：

```bash
# 若已配置 Git 集成，push 自动触发构建
git push origin master:main

# 否则手动部署
npx wrangler pages deploy . --project-name yhg --branch main
```

> 注意：仓库默认分支为 `master`，远端 `main` 为生产分支，推送时须显式指定 `master:main`。

### 环境变量

- `SMTP_USER` / `SMTP_PASS`：QQ 邮箱 SMTP 凭证（发送验证码邮件）

## 安全说明

已完成一轮全量安全审查并修复（见提交 `8683234`）：

- 存储型 XSS：用户输入统一经 `escapeHtml` 转义，事件绑定改用 `data-` 属性 + 事件委托
- 会话：所有端点统一校验 `expires_at`，登录时作废旧会话
- 验证码：按邮箱限次（10 分钟 5 次），防暴力
- 写操作限流：评论/点赞/私信均有频率限制
- 敏感路径（`_private/`、`.pai/`、`wrangler.jsonc`、SQL/脚本等）由 `functions/_middleware.js` 统一拦截返回 403
- Service Worker 使用 stale-while-revalidate，避免旧缓存导致更新不可见

## 开发指引

### 样式

全站共用 `resource/css/style.css`，设计语言：暖象牙底 × 火焰渐变 × 春绿点缀。主题色变量定义在 CSS 自定义属性中（`--fire` / `--spring`）。

### 新增页面

复制同类型现有页面后修改标题、描述与正文，并确认：

- 资源引用使用 `resource/js/main.js`（公共工具 + CSRF 头）与 `resource/js/auth.js`（登录态）
- 当前导航项带 `active` 类
- 页面包含 `viewport` 声明
- 页头使用 `.page-hero` / `.member-hero` 布局

### 前端安全约定

- 所有用户可控文本渲染前必须过 `window.escapeHtml()`
- 不要在内联 `onclick` 等属性中拼接用户数据（用 `data-*` + 事件委托）
- 新增 API 调用依赖 main.js 自动携带的 `X-Requested-By` CSRF 头
