# YHG 电子竞技战队官网 — 后端

Cloudflare Pages + D1 全栈项目，提供战队官网的动态数据接口与管理后台。

## 技术栈

- **平台** — Cloudflare Pages（静态站点 + Functions）
- **数据库** — Cloudflare D1（基于 SQLite 的全球分布式数据库）
- **运行时** — Cloudflare Workers Runtime（`nodejs_compat`）
- **发信** — QQ 邮箱 SMTP（验证码/密码重置）
- **工具** — Wrangler CLI

## 项目结构

```
yhg-modified/
├── functions/api/          # 后端接口
│   ├── auth/               # 认证模块
│   │   ├── crypto.js       #   密码哈希
│   │   ├── login.js        #   登录
│   │   ├── logout.js       #   登出
│   │   ├── register.js     #   注册（含邮箱验证码校验）
│   │   ├── me.js           #   当前用户信息
│   │   ├── profile.js      #   修改昵称/头像
│   │   ├── send-code.js    #   注册验证码发送
│   │   ├── send-reset-code.js  # 密码重置验证码发送
│   │   └── reset-password.js   # 密码重置
│   ├── admin/              # 管理后台接口
│   │   ├── check.js        #   权限验证中间件
│   │   ├── init.js         #   初始化管理员账号
│   │   ├── home.js         #   首页区块编辑
│   │   ├── users/          #   用户管理 CRUD
│   │   ├── articles/       #   文章管理（审核）
│   │   ├── matches/        #   赛事管理 CRUD
│   │   └── players/        #   选手管理
│   ├── news/               # 文章模块
│   │   ├── index.js        #   列表（搜索+分页）+ 创建
│   │   └── [slug]/
│   │       ├── index.js    #   详情/编辑/删除
│   │       ├── like.js     #   点赞切换
│   │       └── comments/   #   评论 CRUD
│   ├── players/            # 选手模块
│   │   ├── index.js        #   选手列表
│   │   └── [slug].js       #   选手详情+编辑权限
│   ├── matches/            # 赛事模块
│   │   └── index.js        #   公开赛事列表
│   └── home.js             # 首页数据聚合
├── admin/index.html        # 管理面板（全功能）
├── *.html                  # 前端页面
├── db_schema.sql           # 完整数据库定义
├── db_seed_*.sql           # 种子数据
└── wrangler.jsonc          # Cloudflare 配置
```

## API 接口

### 认证 `/api/auth/`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/register` | 注册（需 email + code + username + password） | 公开 |
| POST | `/send-code` | 发送注册验证码 | 公开 |
| POST | `/send-reset-code` | 发送密码重置验证码 | 公开 |
| POST | `/reset-password` | 重置密码（验证码校验后） | 公开 |
| POST | `/login` | 登录 | 公开 |
| POST | `/logout` | 登出 | 已登录 |
| GET | `/me` | 当前用户信息（含绑定选手） | 已登录 |
| PUT | `/profile` | 修改昵称/头像 | 已登录 |

### 文章 `/api/news/`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/news` | 列表（`?q=`搜索，`?page=&limit=`分页） | 公开 |
| POST | `/api/news` | 创建文章 | Lv.2+ 或 staff |
| GET | `/api/news/:slug` | 文章详情 | 公开（pending 仅作者/staff） |
| PUT | `/api/news/:slug` | 编辑文章 | 作者或 staff |
| DELETE | `/api/news/:slug` | 删除文章 | 作者或 staff |
| POST | `/:slug/like` | 切换点赞 | 已登录 |
| GET | `/:slug/comments` | 评论列表 | 公开 |
| POST | `/:slug/comments` | 发表评论 | 已登录 |
| DELETE | `/:slug/comments/:id` | 删除评论 | 作者或 staff |

### 管理后台 `/api/admin/`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/init` | 初始化管理员 | 首次 |
| GET | `/check` | 检查管理员状态 | — |
| GET | `/users` | 用户列表 | staff |
| DELETE | `/users/:id` | 删除用户 | admin |
| PUT | `/users/:id` | 绑定选手 | staff |
| PUT | `/users/:id/role` | 修改角色 | admin |
| PUT | `/users/:id/level` | 提升等级 | staff |
| GET | `/articles` | 文章管理列表 | staff |
| DELETE | `/articles/:slug` | 删除文章 | staff |
| PUT | `/articles/:slug/approve` | 通过审核 | staff |
| PUT | `/articles/:slug/reject` | 驳回审核 | staff |
| GET | `/matches` | 赛事管理列表 | staff |
| POST | `/matches` | 新增赛事 | staff |
| PUT | `/matches/:id` | 编辑赛事 | staff |
| DELETE | `/matches/:id` | 删除赛事 | staff |
| GET | `/players` | 选手管理列表 | staff |
| PUT | `/players/:slug` | 更新选手资料 | staff |
| GET | `/home` | 首页区块列表 | staff |
| PUT | `/home` | 更新首页区块 | staff |

### 公开数据

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/players` | 选手列表 |
| GET | `/api/players/:slug` | 选手详情 |
| GET | `/api/matches` | 赛事列表 |
| GET | `/api/home` | 首页数据（含精选比赛） |

## 数据库

10 张表，详见 `db_schema.sql`：

| 表 | 说明 |
|---|---|
| `users` | 用户（含 role/level/avatar） |
| `sessions` | 登录会话 |
| `articles` | 文章（含 status 审核状态） |
| `article_likes` | 文章点赞 |
| `comments` | 文章评论 |
| `players` | 选手资料 |
| `player_bindings` | 用户↔选手多对多绑定 |
| `matches` | 赛事 |
| `home_sections` | 首页区块（key-value） |
| `verification_codes` | 邮箱验证码 |

## 角色体系

| 角色 | 权限 |
|---|---|
| `user` (Lv.1) | 点赞、评论、修改资料 |
| `user` (Lv.2) | 以上 + 发文章（需审核） |
| `sub_admin` | 以上 + 文章自动通过 + 管理后台（不含删除用户/改角色） |
| `admin` | 全部权限 |

## 本地开发

```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 本地开发（默认模拟 D1）
npx wrangler pages dev .

# 操作远程 D1 数据库
npx wrangler d1 execute yhg-db --remote --command="SELECT * FROM users"

# 执行 SQL 文件
npx wrangler d1 execute yhg-db --remote --file=db_schema.sql

# 部署到 Pages
npx wrangler pages deploy .

# 设置环境变量（SMTP 发信用）
npx wrangler pages secret put SMTP_USER --project-name=yhg
npx wrangler pages secret put SMTP_PASS --project-name=yhg
```

## 部署

需在 Cloudflare Dashboard 完成：

1. **Pages 项目** — 已部署，项目名 `yhg`
2. **D1 数据库** — 已创建 `yhg-db`
3. **环境变量**（Secrets）：
   - `SMTP_USER` — QQ 邮箱地址
   - `SMTP_PASS` — QQ 邮箱授权码
4. **自定义域名**（可选）— 在 Pages 项目设置中绑定 `yhg.whitemoon319.xyz`

## 环境变量

| 变量 | 说明 | 必需 |
|---|---|---|
| `SMTP_USER` | QQ 邮箱，用于发验证码 | 是 |
| `SMTP_PASS` | QQ 邮箱授权码 | 是 |
