from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
NEWS_DIR = ROOT / "news"
ARTICLES_DIR = NEWS_DIR / "articles"
INDEX_FILE = NEWS_DIR / "index.html"


def normalize_article_name(value: str) -> str:
    path = Path(value.strip().replace("\\", "/"))
    name = path.name
    return name if name.endswith(".html") else f"{name}.html"


def remove_index_entry(article_name: str) -> bool:
    index_html = INDEX_FILE.read_text(encoding="utf-8")
    href = f"articles/{article_name}"
    pattern = re.compile(rf"\n\s*<a class=\"grid-card\" href=\"{re.escape(href)}\">.*?\n\s*</a>", re.S)
    updated, count = pattern.subn("", index_html, count=1)
    if count:
        INDEX_FILE.write_text(updated, encoding="utf-8")
    return bool(count)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="删除 YHG 新闻文章 HTML，并同步移除 news/index.html 入口。")
    parser.add_argument("article", nargs="?", help="文章文件名、slug 或 news/articles 下的相对路径。")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    article = args.article or input("请输入要删除的文章文件名或 slug：")
    article_name = normalize_article_name(article)
    article_path = ARTICLES_DIR / article_name

    removed_file = False
    if article_path.exists():
        article_path.unlink()
        removed_file = True

    removed_entry = remove_index_entry(article_name)

    if not removed_file and not removed_entry:
        raise SystemExit(f"未找到文章或入口：{article_name}")

    if removed_file:
        print(f"已删除文章：{article_path.relative_to(ROOT)}")
    else:
        print(f"未找到文章文件：{article_path.relative_to(ROOT)}")

    if removed_entry:
        print("已更新入口：news/index.html")
    else:
        print("未找到对应入口：news/index.html")


if __name__ == "__main__":
    main()
