-- 演唱会足迹数据库 schema · Concert-journey database schema
-- 多语言模型：每个可翻译字段以单个 `*_i18n` TEXT 存储 JSON
-- Multi-locale model: each translatable field is stored as a single `*_i18n` TEXT (JSON)
--   {"zh":.., "en":.., "zh-Hant":..}
-- 未来新增语言只需补 JSON，无需 ALTER TABLE。· Adding a new language only needs extra JSON, no ALTER TABLE.

-- 演唱会主表 · Concerts
CREATE TABLE IF NOT EXISTS concerts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_i18n       TEXT NOT NULL,                 -- 歌手（多语言 JSON）· artist (multi-locale JSON)
  concert_name_i18n TEXT NOT NULL,                 -- 演唱会名称（多语言 JSON）· concert name (multi-locale JSON)
  theme_i18n        TEXT,                          -- 主题（多语言 JSON）· theme (multi-locale JSON)
  country_i18n      TEXT,                          -- 国家（多语言 JSON）· country (multi-locale JSON)
  province_i18n     TEXT,                          -- 省份（多语言 JSON）· province (multi-locale JSON)
  city_i18n         TEXT,                          -- 城市（多语言 JSON）· city (multi-locale JSON)
  venue_i18n        TEXT,                          -- 场馆（多语言 JSON）· venue (multi-locale JSON)
  seat_i18n         TEXT,                          -- 座位（多语言 JSON）· seat (multi-locale JSON)
  price_i18n        TEXT,                          -- 票价（多语言 JSON）· price (multi-locale JSON)
  date              TEXT NOT NULL,                 -- 日期 YYYY-MM-DD · date YYYY-MM-DD
  time              TEXT,                          -- 时间 HH:MM · time HH:MM
  poster            TEXT,                          -- 海报 URL · poster URL
  description_i18n  TEXT,                          -- 描述（多语言 JSON）· description (multi-locale JSON)
  video_i18n        TEXT,                          -- 视频标题（多语言 JSON）· video title (multi-locale JSON)
  video_url_i18n    TEXT,                          -- 视频地址（多语言 JSON）· video URL (multi-locale JSON)
  seq               INTEGER DEFAULT 0              -- 排序 · sort order
);

-- 演唱会点赞 · Concert likes（按 IP 去重，可取消）
-- 说明：点赞数一律以此表 COUNT 统计（concerts 不再冗余存储 likes 列）。
-- Note: like counts are always aggregated via COUNT on this table (concerts no longer stores a redundant likes column).
--       同一 IP 对同一场演唱会仅一条记录；取消点赞即删除该行。
--       One row per IP per concert; unliking deletes that row.
CREATE TABLE IF NOT EXISTS concert_likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,   -- 自增主键 · auto-increment primary key
  concert_id  INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,  -- 演唱会编号 · concert id
  ip          TEXT NOT NULL,                       -- 点赞者 IP · liker IP
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),  -- 创建时间 · created at
  UNIQUE (concert_id, ip)                          -- 同一 IP 对同一场仅一条 · one row per IP per concert
);

-- 按 IP 查询点赞集合 / 统计加速 · speed up per-IP like lookups (liked set, counts)
CREATE INDEX IF NOT EXISTS idx_concert_likes_ip ON concert_likes(ip);

-- 演唱会标签 · Concert tags（每行一个标签，i18n 为各语言数组 JSON）
-- Concert tags (one row per tag; i18n is a per-locale array JSON)
CREATE TABLE IF NOT EXISTS concert_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concert_id  INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,  -- 演唱会编号 · concert id
  i18n        TEXT NOT NULL,                      -- {"zh":[".."],"en":[".."],...}
  seq         INTEGER DEFAULT 0                   -- 排序 · sort order
);

-- 演唱会图片 · Concert images
CREATE TABLE IF NOT EXISTS concert_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concert_id  INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,  -- 演唱会编号 · concert id
  url         TEXT NOT NULL,                      -- 图片地址 · image URL
  alt_i18n    TEXT,                               -- 替代文本（多语言 JSON）· alt text (multi-locale JSON)
  sort_order  INTEGER DEFAULT 0                   -- 排序 · sort order
);

-- 演唱会歌单 · Concert songlist
CREATE TABLE IF NOT EXISTS concert_songlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concert_id  INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,  -- 演唱会编号 · concert id
  i18n        TEXT NOT NULL,                      -- 歌曲名（多语言 JSON）· song name (multi-locale JSON)
  link        TEXT,                               -- 歌曲链接 · song link
  seq         INTEGER DEFAULT 0                   -- 排序 · sort order
);

-- 城市 · Cities
CREATE TABLE IF NOT EXISTS cities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  country_i18n TEXT,                              -- 国家（多语言 JSON）· country (multi-locale JSON)
  name_i18n   TEXT NOT NULL,                      -- 城市名（多语言 JSON）· city name (multi-locale JSON)
  seq         INTEGER DEFAULT 0,                  -- 排序 · sort order
  icon        TEXT                                -- 图标 emoji · icon emoji
);

-- 许愿 · Wishes
CREATE TABLE IF NOT EXISTS wishes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content_i18n TEXT NOT NULL,                     -- 许愿内容（多语言 JSON）· wish content (multi-locale JSON)
  likes       INTEGER DEFAULT 0,                  -- 点赞数 · like count
  liked       INTEGER DEFAULT 0                   -- 当前用户是否点赞 · whether current user liked
);

-- ==================== 站点级 SEO 设置 · Site-level SEO settings ====================
-- 说明：内容/运营维度的 SEO 参数（title / description / keywords / og:image / twitter:*）
-- Note: content/operation-level SEO params (title / description / keywords / og:image / twitter:*) are
--        moved into the database, supporting 5-locale online config without rebuild.
--       代码层始终保留回退默认值（见 server/lib/mappers.ts 的 fetchSiteSeo），DB 不可用时不降级为空。
--       The code layer keeps fallbacks (see fetchSiteSeo) so it never degrades to empty when the DB is unavailable.
-- 注意：SITE_URL（域名）属「部署维度」而非内容维度，不入库，见 nuxt.config.ts 的
-- Note: SITE_URL (domain) is a deployment concern, not content, so it is not in the DB — see nuxt.config.ts
--       runtimeConfig.public.siteUrl（环境变量 NUXT_PUBLIC_SITE_URL）。
--       runtimeConfig.public.siteUrl (env NUXT_PUBLIC_SITE_URL).

-- 站点级 SEO 设置（与语言无关的字段，强制单行）· Site settings (single row enforced)
CREATE TABLE IF NOT EXISTS site_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),  -- 强制单行，避免重复插入 · enforce single row, avoid duplicate inserts
  og_image        TEXT,                 -- OG 图 URL 或路径（全语言共用）· OG image URL or path (shared across locales)
  twitter_site    TEXT,                 -- Twitter 账号（如 '@layicr'）· Twitter handle (e.g. '@layicr')
  twitter_creator TEXT,                 -- Twitter 创建者 · Twitter creator
  author          TEXT,                 -- 作者 · author
  robots          TEXT DEFAULT 'index, follow', -- 爬虫指令（默认 index, follow）· crawler directive (default index, follow)
  site_url        TEXT                  -- 站点正式地址（HTTPS）；运营可改，缺失回退 NUXT_PUBLIC_SITE_URL / 代码兜底
                                        -- Official site URL (HTTPS); editable by ops, falls back to NUXT_PUBLIC_SITE_URL / code default
);

-- 站点级 SEO 多语言文案（沿用 *_i18n JSON 惯例）· Site SEO copy per locale
CREATE TABLE IF NOT EXISTS site_seo_i18n (
  key         TEXT PRIMARY KEY,          -- 'site_title' | 'site_description' | 'keywords'
  value_i18n  TEXT NOT NULL             -- 多语言文案 JSON · value JSON
);

-- 种子数据（初始值与既有硬编码保持一致）· Seed data (same as former hard-coded values)
-- INSERT OR IGNORE 保证幂等：重复执行不报错，也不会覆盖运营已在库中改过的值。
-- INSERT OR IGNORE keeps it idempotent: re-running never errors nor overwrites operator-edited values.
INSERT OR IGNORE INTO site_settings (id, og_image, twitter_site, twitter_creator, author, robots, site_url)
VALUES (1, '/img/og-image.svg', '@layicr', '@layicr', 'layicr', 'index, follow', 'https://ilive.lyc.la');

INSERT OR IGNORE INTO site_seo_i18n (key, value_i18n) VALUES
  ('site_title', json_object('zh-CN','Layicr演唱会足迹','en','Layicr Concert Journey','zh-Hant','Layicr演唱會足跡')),
  ('site_description', json_object('zh-CN','Layicr的个人演唱会足迹记录网站。','en','Layicr''s personal concert journey site.','zh-Hant','Layicr 的個人演唱會足跡記錄網站。')),
  ('keywords', json_object('zh-CN','演唱会足迹,演唱会记录','en','concert journey,concert record','zh-Hant','演唱會足跡,演唱會記錄'));

-- ==================== 友情链接 · Friend links ====================
-- 说明：页脚社交/友情链接原先硬编码在 app/composables/useFriendLink.ts，现下沉到数据库，
-- Note: footer social/friend links were hard-coded in useFriendLink.ts; now moved to the DB,
--       支持 3 语言在线配置（沿用 *_i18n JSON 惯例）；代码层始终保留回退列表（见该 composable），
--       supporting 3-locale online config (the *_i18n JSON convention); the code keeps a fallback list (see the composable),
--       DB 为空 / 缺字段 / 查询失败时页面照常渲染，不出现空列表或空名称。
--       so the page still renders (no empty list/name) when the DB is empty / missing / failing.
--       与 SEO 同理：href 等「结构字段」入库，仅「内容/运营」维度的文案需多语言。
--       Like SEO: structural fields (href) live in the DB; only content/operation copy needs localization.

-- 友情链接 · Friend links
CREATE TABLE IF NOT EXISTS friend_links (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  href             TEXT NOT NULL UNIQUE,          -- 链接地址（唯一约束，保证种子幂等）· link href (UNIQUE, idempotent seeds)
  icon             TEXT,                          -- Font Awesome 图标类名（如 'fab fa-github'）· Font Awesome class (e.g. 'fab fa-github')
  title_i18n       TEXT NOT NULL,                -- 链接名称（多语言 JSON）· link title (multi-locale JSON)
  description_i18n TEXT,                          -- 链接描述（多语言 JSON，可选）· link description (multi-locale JSON, optional)
  seq              INTEGER DEFAULT 0,             -- 排序（越小越靠前）· sort order (smaller = earlier)
  enabled          INTEGER DEFAULT 1             -- 启用状态：1 启用 / 0 停用 · enabled: 1 on / 0 off
);

-- 种子数据（初始值与既有硬编码一致，顺序与原 friendLink.js 相同）· Seed data (same as former hard-coded list)
-- INSERT OR IGNORE 保证幂等：重复执行不报错，也不会覆盖运营已在库中改过的值。
-- INSERT OR IGNORE keeps it idempotent: re-running never errors nor overwrites operator-edited values.
INSERT OR IGNORE INTO friend_links (href, icon, title_i18n, description_i18n, seq, enabled) VALUES
  ('https://www.lyc.la', 'fas fa-globe',
   json_object('zh-CN','lyc.la','en','lyc.la','zh-Hant','lyc.la'),
   json_object('zh-CN','Layicr 的个人网站','en','Layicr''s personal site','zh-Hant','Layicr 的個人網站'), 1, 1),
  ('https://github.com/layicr/ilive_neo', 'fab fa-github',
   json_object('zh-CN','GitHub','en','GitHub','zh-Hant','GitHub'),
   json_object('zh-CN','GitHub','en','GitHub repository','zh-Hant','GitHub'), 2, 1),
  ('https://weibo.com/layicr', 'fab fa-weibo',
   json_object('zh-CN','微博','en','Weibo','zh-Hant','微博'),
   json_object('zh-CN','微博','en','Weibo profile','zh-Hant','微博'), 3, 1),
  ('https://mp.weixin.qq.com/s/S1sq45LC_iQuCLYxzoaRkw', 'fab fa-weixin',
   json_object('zh-CN','微信','en','WeChat','zh-Hant','微信'),
   json_object('zh-CN','微信','en','WeChat official account','zh-Hant','微信'), 4, 1),
  ('https://v.douyin.com/5nAiAZQoUXw/', 'fab fa-tiktok',
   json_object('zh-CN','抖音','en','Douyin','zh-Hant','抖音'),
   json_object('zh-CN','抖音','en','Douyin profile','zh-Hant','抖音'), 5, 1),
  ('https://space.bilibili.com/29825132', 'fa fa-video-camera',
   json_object('zh-CN','B站','en','Bilibili','zh-Hant','B站'),
   json_object('zh-CN','哔哩哔哩','en','Bilibili profile','zh-Hant','嗶哩嗶哩'), 6, 1),
  ('https://twitter.com/layicr', 'fab fa-twitter',
   json_object('zh-CN','推特','en','Twitter','zh-Hant','推特'),
   json_object('zh-CN','推特','en','Twitter profile','zh-Hant','推特'), 7, 1),
  ('https://www.instagram.com/ilayicr', 'fab fa-instagram',
   json_object('zh-CN','Instagram','en','Instagram','zh-Hant','Instagram'),
   json_object('zh-CN','Instagram','en','Instagram profile','zh-Hant','Instagram'), 8, 1),
  ('https://www.facebook.com/layicr', 'fab fa-facebook',
   json_object('zh-CN','Facebook','en','Facebook','zh-Hant','Facebook'),
   json_object('zh-CN','Facebook','en','Facebook profile','zh-Hant','Facebook'), 9, 1);
