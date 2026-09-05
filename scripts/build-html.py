#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YHG HTML 预编译生成器
========================
将 13 个静态页的 header/footer 统一为模板输出，消除逐页复制维护。

- head / body 保留各页原文（10 种 head 变体安全保留）
- header / footer 由模板生成（参数：base 前缀、active 导航、auth 占位、footer 文案）
- 404.html 无 header/footer，跳过

用法：
  python scripts/build-html.py            # 生成并落盘
  python scripts/build-html.py --check    # 只生成到内存对比，不落盘
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ===== 每页配置 =====
# path: 相对仓库根目录
# base: 资源/导航相对路径前缀（根页面 ''，子页面 '../'）
# active: 导航高亮项（'home'|'about'|'members'|'matches'|'news'|'none'）
# auth: 'widget' | 'stateBtn' | 'none'
# footer: footer 文案
# brand_alt: 品牌 alt 文本
PAGES = [
    {'path': 'index.html', 'base': '', 'active': 'home', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team · official site demo'},
    {'path': 'about/index.html', 'base': '../', 'active': 'about', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG电子竞技战队. Honor of Kings esports team official site demo.'},
    {'path': 'members/index.html', 'base': '../', 'active': 'members', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG电子竞技战队. Honor of Kings esports team official site demo.'},
    {'path': 'matches/index.html', 'base': '../', 'active': 'matches', 'auth': 'widget', 'brand_alt': 'YHG',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'brand_aria': False},
    {'path': 'news/index.html', 'base': '../', 'active': 'news', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG电子竞技战队. Honor of Kings esports team official site demo.', 'brand_aria': False},
    {'path': 'login/index.html', 'base': '../', 'active': 'none', 'auth': 'stateBtn', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'auth_state_text': '登录', 'brand_href': './'},
    {'path': 'register/index.html', 'base': '../', 'active': 'none', 'auth': 'stateBtn', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'auth_state_text': '注册', 'brand_href': './'},
    {'path': 'forgot-password/index.html', 'base': '../', 'active': 'none', 'auth': 'stateBtn', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'auth_state_text': '重置密码', 'brand_href': './'},
    {'path': 'dashboard/index.html', 'base': '../', 'active': 'none', 'auth': 'stateBtn', 'brand_alt': 'YHG',
     'footer': '© 2026 YHG ESPORTS', 'auth_state_text': '用户', 'brand_aria': False, 'brand_href': './'},
    {'path': 'admin/index.html', 'base': '../', 'active': 'none', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS', 'auth_state_text': '管理'},
    {'path': 'messages/index.html', 'base': '../', 'active': 'none', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'auth_state_text': '私信'},
    {'path': 'notifications/index.html', 'base': '../', 'active': 'none', 'auth': 'widget', 'brand_alt': 'YHG战队标识',
     'footer': '© 2026 YHG ESPORTS · Honor of Kings esports team', 'auth_state_text': '通知'},
]

NAV_ITEMS = [
    ('home', 'HOME', './'),
    ('about', 'ABOUT', 'about/'),
    ('members', 'ROSTER', 'members/'),
    ('matches', 'MATCHES', 'matches/'),
    ('news', 'NEWS', 'news/'),
]


def build_header(base, active, auth, brand_alt, auth_state_text='用户', brand_href=None, brand_aria=True):
    """返回 header 块，每行已带最终缩进（顶层 4 空格）"""
    # brand 链接：根页面 './'，子页面 base 原样（如 '../'）
    if brand_href is None:
        brand_href = base if base else './'
    lines = [
        '    <header class="site-header">',
        f'        <a class="brand" href="{brand_href}"' + (' aria-label="返回首页"' if brand_aria else '') + '>',
        f'            <img src="{base}resource/img/logo.webp" alt="{brand_alt}" width="34" height="34">',
        '            <span>YHG</span>',
        '        </a>',
        '        <nav class="nav" aria-label="主导航">',
    ]
    for key, label, suffix in NAV_ITEMS:
        if key == active:
            href = './'  # 当前页：指向自身
        elif suffix == './':
            href = base if base else './'  # HOME：与 brand 一致
        else:
            href = base + suffix
        cls = ' class="active"' if key == active else ''
        lines.append(f'            <a{cls} href="{href}">{label}</a>')
    lines.append('        </nav>')
    if auth == 'widget':
        if auth_state_text:
            lines.append(f'        <div id="authWidget" style="cursor:default;">{auth_state_text}</div>')
        else:
            lines.append('        <div id="authWidget"></div>')
    elif auth == 'stateBtn':
        lines.append(f'        <div id="authStateBtn" style="cursor:default;">{auth_state_text}</div>')
    lines.append('    </header>')
    return '\n'.join(lines)


def build_footer(text):
    return f'    <footer>\n        <p>{text}</p>\n    </footer>'


def generate(html, cfg):
    """用模板替换 html 中的 header/footer 区域（保留原前导缩进）"""
    header_html = build_header(cfg['base'], cfg['active'], cfg['auth'], cfg['brand_alt'],
                               cfg.get('auth_state_text', ''), cfg.get('brand_href'), cfg.get('brand_aria', True))
    footer_html = build_footer(cfg['footer'])

    def shift_block(block, indent):
        """把模板块整体平移到 indent 基准：块内相对缩进不变"""
        lines = block.splitlines()
        min_indent = min(len(ln) - len(ln.lstrip()) for ln in lines if ln.strip())
        out = []
        for ln in lines:
            rel = ln[min_indent:]  # 去掉模板基准缩进
            out.append(indent + rel)
        return '\n'.join(out)

    # 替换 header
    new = re.sub(
        r'([ \t]*)<header class="site-header">.*?</header>',
        lambda m: shift_block(header_html, m.group(1)),
        html, count=1, flags=re.S
    )
    # 替换 footer
    new = re.sub(
        r'([ \t]*)<footer>.*?</footer>',
        lambda m: shift_block(footer_html, m.group(1)),
        new, count=1, flags=re.S
    )
    return new


def main():
    check_only = '--check' in sys.argv
    changed = []
    unchanged = []
    errors = []

    for cfg in PAGES:
        path = os.path.join(ROOT, cfg['path'])
        try:
            html = open(path, encoding='utf-8').read()
        except FileNotFoundError:
            errors.append(f'{cfg["path"]}: 文件不存在')
            continue
        generated = generate(html, cfg)
        if generated == html:
            unchanged.append(cfg['path'])
            continue
        changed.append(cfg['path'])
        if check_only:
            # 校验：head/body 未被改动（仅 header/footer 区域允许差异）
            old_h = re.search(r'<header class="site-header">.*?</header>', html, re.S)
            new_h = re.search(r'<header class="site-header">.*?</header>', generated, re.S)
            old_f = re.search(r'<footer>.*?</footer>', html, re.S)
            new_f = re.search(r'<footer>.*?</footer>', generated, re.S)
            # 除 header/footer 外的部分应逐字节一致
            rest_old = html[:old_h.start()] + html[old_h.end():old_f.start()] + html[old_f.end():]
            rest_new = generated[:new_h.start()] + generated[new_h.end():new_f.start()] + generated[new_f.end():]
            if rest_old != rest_new:
                errors.append(f'{cfg["path"]}: head/body 被误改！')
            else:
                print(f'[diff] {cfg["path"]} (仅 header/footer)')
        else:
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(generated)

    print(f'--- 检查: {len(changed)} 个文件需要更新, {len(unchanged)} 个已一致')
    if errors:
        print('--- 错误:')
        for e in errors:
            print(' ', e)
        return 1
    if check_only:
        if changed:
            print('--- 差异！请运行: python scripts/build-html.py 后提交生成结果')
            return 1
        print('--- check 通过：模板与仓库一致')
    return 0


if __name__ == '__main__':
    sys.exit(main())
