from __future__ import annotations

import argparse
import html
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
NEWS_DIR = ROOT / "news"
ARTICLES_DIR = NEWS_DIR / "articles"
INDEX_FILE = NEWS_DIR / "index.html"


def slugify(title: str, now: datetime) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    timestamp = now.strftime("%Y%m%d-%H%M%S")
    return f"{timestamp}-{slug}" if slug else f"article-{timestamp}"


def read_body_from_stdin() -> str:
    print("请输入正文内容。输入单独一行 END 后结束：")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == "END":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def ensure_indent(text: str) -> str:
    return text if re.match(r"^[\s\u3000]", text) else f"\u3000\u3000{text}"


def paragraphs_from_body(body: str) -> str:
    blocks = [block for block in re.split(r"\n\s*\n", body.strip()) if block.strip()]
    paragraphs: list[str] = []
    for block in blocks:
        lines = [ensure_indent(line.strip()) for line in block.splitlines() if line.strip()]
        paragraphs.append("<br>".join(html.escape(line) for line in lines))
    return "\n".join(f"                <p>{paragraph}</p>" for paragraph in paragraphs)


def excerpt_from_body(body: str, length: int = 72) -> str:
    text = re.sub(r"\s+", " ", body).strip()
    return text[:length] + ("..." if len(text) > length else "")


def article_html(title: str, summary: str, body: str, date_display: str) -> str:
    escaped_title = html.escape(title)
    escaped_summary = html.escape(summary)
    content = paragraphs_from_body(body)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escaped_title} - YHG电子竞技战队</title>
    <meta name="description" content="{escaped_summary}">
    <link rel="icon" type="image/webp" href="../../resource/img/logo.webp">
    <link rel="apple-touch-icon" href="../../resource/img/logo.webp">
    <link rel="stylesheet" href="../../resource/css/style.css">
    <style>
        .article-section {{
            padding-top: clamp(64px, 8vw, 96px);
        }}

        .article-card {{
            max-width: 920px;
            margin: 0 auto;
            padding: clamp(30px, 5vw, 56px);
            background: var(--glass);
            border: 1px solid var(--line-2);
            border-radius: var(--r-lg);
            box-shadow: var(--shadow);
            backdrop-filter: blur(14px) saturate(140%);
            -webkit-backdrop-filter: blur(14px) saturate(140%);
        }}

        .article-body {{
            color: var(--text);
            font-size: clamp(17px, 2vw, 19px);
            line-height: 2.05;
        }}

        .article-body p + p {{
            margin-top: 1.15em;
        }}

        .article-actions {{
            max-width: 920px;
            margin: 34px auto 0;
        }}
    </style>
</head>
<body>
    <header class="site-header">
        <a class="brand" href="../../" aria-label="返回首页">
            <img src="../../resource/img/logo.webp" alt="YHG战队标识">
            <span>YHG</span>
        </a>
        <nav class="nav" aria-label="主导航">
            <a href="../../">HOME</a>
            <a href="../../about/">ABOUT</a>
            <a href="../../members/">ROSTER</a>
            <a href="../../matches/">MATCHES</a>
            <a class="active" href="../">NEWS</a>
        </nav>
        <a class="join-btn" href="../">返回新闻</a>
    </header>

    <main>
        <section class="page-hero">
            <div class="embers" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i><i></i>
                <i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <div class="page-hero-content">
                <div class="eyebrow">TEAM NEWS // {html.escape(date_display)}</div>
                <h1>{escaped_title}</h1>
                <p>{escaped_summary}</p>
            </div>
        </section>

        <section class="section article-section">
            <article class="article-card">
                <div class="article-body">
{content}
                </div>
            </article>
            <div class="article-actions">
                <a class="ghost-btn" href="../">返回新闻列表</a>
            </div>
        </section>
    </main>

    <footer>
        <p>© 2026 YHG电子竞技战队. Honor of Kings esports team official site demo.</p>
    </footer>
</body>
</html>
"""


def index_entry(title: str, summary: str, slug: str, date_display: str) -> str:
    return f"""                <a class="grid-card" href="articles/{html.escape(slug)}.html">
                    <div class="meta">{html.escape(date_display)}</div>
                    <h3>{html.escape(title)}</h3>
                    <p>{html.escape(summary)}</p>
                </a>
"""


def update_index(title: str, summary: str, slug: str, date_display: str) -> None:
    index_html = INDEX_FILE.read_text(encoding="utf-8")
    marker = '            <div class="card-grid">\n'
    if marker not in index_html:
        raise RuntimeError("未找到 news/index.html 中的新闻卡片区域。")
    updated = index_html.replace(marker, marker + index_entry(title, summary, slug, date_display), 1)
    INDEX_FILE.write_text(updated, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成 YHG 新闻文章 HTML，并更新 news/index.html 入口。")
    parser.add_argument("--title", help="文章标题。不传则进入交互输入。")
    parser.add_argument("--summary", help="文章概括。不传则进入交互输入。")
    parser.add_argument("--body-file", type=Path, help="正文文本文件。不传则进入交互输入。")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    title = (args.title or input("请输入文章标题：")).strip()
    if not title:
        raise SystemExit("文章标题不能为空。")

    summary = (args.summary or input("请输入文章概括：")).strip()
    if not summary:
        raise SystemExit("文章概括不能为空。")

    if args.body_file:
        body = args.body_file.read_text(encoding="utf-8").strip()
    else:
        body = read_body_from_stdin()
    if not body:
        raise SystemExit("正文内容不能为空。")

    now = datetime.now()
    slug = slugify(title, now)
    date_display = now.strftime("%Y / %m / %d")
    article_path = ARTICLES_DIR / f"{slug}.html"

    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    article_path.write_text(article_html(title, summary, body, date_display), encoding="utf-8")
    update_index(title, summary, slug, date_display)

    print(f"已生成文章：{article_path.relative_to(ROOT)}")
    print("已更新入口：news/index.html")


if __name__ == "__main__":
    main()
