# YHG ESPORTS

[](#yhg-esports)

YHG 电子竞技战队官方展示站 —— 王者荣耀分部，以"野火精神"为核心文化，汇聚怀揣竞技理想的青年选手，持续向更高赛场发起冲击。

> 在线访问：[www.whitemoon319.site](https://www.whitemoon319.site)

## 技术栈

[](#技术栈)

原生 HTML5 · CSS3，零构建流程的纯静态站点，部署于 Cloudflare Pages（Wrangler）与GitHub Pages。

## 页面导览

[](#页面导览)

路径

内容

`/`

响应式首页（野火精神、快速入口、战队关键词）

`about/`

战队介绍：文化、专业体系、野火精神、竞技理念与未来愿景

`members/`

队员阵容一览，含各选手详情页（角色、战力雷达、个人信息）

`matches/`

赛事赛程记录

`news/`

战队新闻及文章详情

## 本地运行

[](#本地运行)

需通过 HTTP 服务访问，以保证路径行为与线上一致。

```bash
npx wrangler pages dev .
```

或使用 Python：

```bash
python -m http.server 8000
```

访问 `http://localhost:8000/` 即可。

## 目录结构

[](#目录结构)

```
.
├── index.html                     # 首页
├── about/index.html               # 关于 YHG
├── members/
│   ├── index.html                 # 阵容一览
│   ├── alang/index.html           # 选手详情
│   ├── chenjing/index.html
│   ├── chuowei/index.html
│   ├── linyuan/index.html
│   ├── mingyang/index.html
│   ├── yumu/index.html
│   └── yunji/index.html
├── matches/index.html             # 赛事赛程
├── news/
│   ├── index.html                 # 新闻列表
│   └── articles/                  # 文章详情
├── resource/
│   ├── css/style.css
│   └── img/                       # Logo、选手照片
├── CNAME
├── robots.txt
├── sitemap.xml
└── wrangler.jsonc
```

## 响应式适配

[](#响应式适配)

所有页面共用统一 CSS，断点：

- **1080px**：网格内容切换为双列布局，隐藏 section 角标
- **860px**：隐藏导航栏，全部布局切换为单列
- **640px**：紧凑排版，缩小头部高度、减少间距

## 可访问性

[](#可访问性)

- 语义化 HTML 地标（`<header>`、`<nav>`、`<main>`、`<section>`、`<footer>`）
- 导航与区域节均提供 `aria-label`
- 当前栏目使用 `.active` 样式高亮
- `prefers-reduced-motion` 动画降级
- `scroll-behavior: smooth` 平滑滚动

## SEO

[](#seo)

- 全页面 `meta description` 描述信息
- `link rel="icon"` + `apple-touch-icon`
- `sitemap.xml` + `robots.txt`
- 自定义域名 `www.whitemoon319.site`

## 开发指引

[](#开发指引)

### 样式

[](#样式)

所有页面共用 `resource/css/style.css`，设计语言：暖象牙底 × 火焰渐变 × 春绿点缀。

主题色变量定义在 CSS 自定义属性中，按 `--fire` / `--spring` 两组色彩体系组织。

### 新增内容页

[](#新增内容页)

复制同类型现有页面后修改标题、描述与正文内容，并确认：

- 资源引用路径正确（`../resource/`）
- 当前导航项带 `active` 类
- 页面包含 `viewport` 声明
- 页头使用 `.page-hero` / `.member-hero` 布局
