-- ============================================================
-- 演唱会足迹 · 数据库表结构 · Concert Journey DB Schema
-- 沿用现有 {zh,en} 双语结构 · Keep existing bilingual {zh,en} structure
-- 适用本地 SQLite（file:）与远程 Turso（libsql:）
-- ============================================================

-- 演唱会表 · Concert table
CREATE TABLE IF NOT EXISTS concerts (
  id             INTEGER PRIMARY KEY,          -- 演唱会ID · Concert ID
  artist_zh      TEXT NOT NULL,                -- 艺人(中) · Artist (zh)
  artist_en      TEXT NOT NULL,                -- 艺人(英) · Artist (en)
  concert_name_zh TEXT NOT NULL,               -- 演唱会名(中) · Concert name (zh)
  concert_name_en TEXT NOT NULL,               -- 演唱会名(英) · Concert name (en)
  theme_zh       TEXT,                         -- 主题(中) · Theme (zh)
  theme_en       TEXT,                         -- 主题(英) · Theme (en)
  country_zh     TEXT,                         -- 国家(中) · Country (zh)
  country_en     TEXT,                         -- 国家(英) · Country (en)
  province_zh    TEXT,                         -- 省(中) · Province (zh)
  province_en    TEXT,                         -- 省(英) · Province (en)
  city_zh        TEXT,                         -- 市(中) · City (zh)
  city_en        TEXT,                         -- 市(英) · City (en)
  venue_zh       TEXT,                         -- 体育场(中) · Venue (zh)
  venue_en       TEXT,                         -- 体育场(英) · Venue (en)
  seat_zh        TEXT,                         -- 座位(中) · Seat (zh)
  seat_en        TEXT,                         -- 座位(英) · Seat (en)
  price_zh       TEXT,                         -- 价格(中) · Price (zh)
  price_en       TEXT,                         -- 价格(英) · Price (en)
  date           TEXT NOT NULL,                -- 日期 YYYY.MM.DD · Date
  time           TEXT,                         -- 时间 HH:MM · Time
  poster         TEXT,                         -- 海报路径 · Poster path
  description_zh TEXT,                         -- 详细描述(中) · Description (zh)
  description_en TEXT,                         -- 详细描述(英) · Description (en)
  video_zh       TEXT,                         -- 视频BV号(中) · Video BV (zh)
  video_en       TEXT,                         -- 视频BV号(英) · Video BV (en)
  video_url_zh   TEXT,                         -- 视频外链(中) · Video URL (zh)
  video_url_en   TEXT                          -- 视频外链(英) · Video URL (en)
);

-- 演唱会标签表 · Concert tags
CREATE TABLE IF NOT EXISTS concert_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 主键 · PK
  concert_id  INTEGER NOT NULL,                  -- 关联演唱会 · FK to concerts
  zh          TEXT NOT NULL,                     -- 标签(中) · Tag (zh)
  en          TEXT NOT NULL,                     -- 标签(英) · Tag (en)
  FOREIGN KEY (concert_id) REFERENCES concerts(id)
);

-- 演唱会图片表 · Concert images
CREATE TABLE IF NOT EXISTS concert_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 主键 · PK
  concert_id  INTEGER NOT NULL,                  -- 关联演唱会 · FK to concerts
  src         TEXT NOT NULL,                     -- 图片路径 · Image src
  alt_zh      TEXT,                              -- 描述(中) · Alt (zh)
  alt_en      TEXT,                              -- 描述(英) · Alt (en)
  FOREIGN KEY (concert_id) REFERENCES concerts(id)
);

-- 演唱会歌单表 · Concert songlist
CREATE TABLE IF NOT EXISTS concert_songlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 主键 · PK
  concert_id  INTEGER NOT NULL,                  -- 关联演唱会 · FK to concerts
  seq         INTEGER NOT NULL,                  -- 排序 · Sequence
  zh          TEXT NOT NULL,                     -- 歌名(中) · Song (zh)
  en          TEXT NOT NULL,                     -- 歌名(英) · Song (en)
  link        TEXT                               -- 播放链接(可选) · Play link
  , FOREIGN KEY (concert_id) REFERENCES concerts(id)
);

-- 城市表 · Cities
CREATE TABLE IF NOT EXISTS cities (
  id         INTEGER PRIMARY KEY,                -- 城市ID · City ID
  country_zh TEXT,                              -- 国家(中) · Country (zh)
  country_en TEXT,                              -- 国家(英) · Country (en)
  name_zh    TEXT NOT NULL,                      -- 城市名(中) · City name (zh)
  name_en    TEXT NOT NULL,                      -- 城市名(英) · City name (en)
  icon       TEXT                                -- 图标 · Icon
);

-- 许愿墙表 · Wish wall
CREATE TABLE IF NOT EXISTS wishes (
  id         INTEGER PRIMARY KEY,                -- 心愿ID · Wish ID
  content_zh TEXT NOT NULL,                      -- 内容(中) · Content (zh)
  content_en TEXT NOT NULL,                      -- 内容(英) · Content (en)
  time       TEXT NOT NULL,                      -- 时间 · Time
  likes      INTEGER DEFAULT 0,                  -- 点赞数 · Likes
  liked      INTEGER DEFAULT 0                   -- 是否已赞 · Liked (0/1)
);