-- YHG 数据库完整 Schema（v2 — 新增用户头像、点赞、评论、赛事、首页管理）
-- 部署步骤:
--   1. npx wrangler d1 create yhg-db
--   2. 把 database_id 填到 wrangler.jsonc
--   3. npx wrangler d1 execute yhg-db --file=db_schema.sql
-- 从旧版升级只要再跑一次本文件（全部 CREATE TABLE IF NOT EXISTS / ALTER TABLE）

-- ===== 用户 =====
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',       -- 'user' | 'sub_admin' | 'admin'
  player_slug TEXT DEFAULT NULL,
  avatar TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  level INTEGER NOT NULL DEFAULT 1
);
-- 已有表则补 avatar/level 列
ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;

-- ===== 会话 =====
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ===== 文章 =====
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  content TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

-- ===== 文章点赞（每用户每文章只能点一次） =====
CREATE TABLE IF NOT EXISTS article_likes (
  article_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, user_id),
  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ===== 文章评论 =====
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);

-- ===== 选手资料 =====
CREATE TABLE IF NOT EXISTS players (
  slug TEXT PRIMARY KEY,
  id_name TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER DEFAULT 0,
  role TEXT NOT NULL,
  titles TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  anchor TEXT DEFAULT '',
  experience TEXT DEFAULT '',
  stats TEXT DEFAULT '{}',
  avatar TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ===== 邮箱验证码 =====
CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vcode_email ON verification_codes(email);

-- ===== 选手绑定（多对多） =====
CREATE TABLE IF NOT EXISTS player_bindings (
  user_id INTEGER NOT NULL,
  player_slug TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, player_slug),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (player_slug) REFERENCES players(slug)
);
CREATE INDEX IF NOT EXISTS idx_player_bindings_user ON player_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_player_bindings_player ON player_bindings(player_slug);

-- ===== 赛事 =====
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                    -- 赛事名称 e.g. "2026 KPL 春季赛"
  opponent TEXT NOT NULL,                 -- 对手
  match_date TEXT NOT NULL,               -- 比赛日期 YYYY-MM-DD
  result TEXT DEFAULT '',                 -- 'win' | 'lose' | 'draw' | ''
  score TEXT DEFAULT '',                  -- e.g. "3:1"
  description TEXT DEFAULT '',            -- 比赛简述
  featured INTEGER DEFAULT 0,             -- 1=展示在首页
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ===== 首页区块（key-value 灵活管理） =====
CREATE TABLE IF NOT EXISTS home_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT UNIQUE NOT NULL,       -- 'hero_title', 'hero_subtitle', 'about_text', 'featured_match_id'
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 预置首页区块
INSERT OR IGNORE INTO home_sections (section_key, content) VALUES
  ('hero_title', 'YHG'),
  ('hero_subtitle', '永不言弃'),
  ('about_text', 'YHG 电子竞技俱乐部成立于2022年，致力于王者荣耀职业联赛（KPL）。');

-- ===== IP 频率限制 =====
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip, endpoint, window_start);
