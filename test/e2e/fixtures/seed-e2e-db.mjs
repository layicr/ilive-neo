/**
 * E2E 专用测试库种子脚本 · Seed the dedicated E2E fixture database
 *
 * @description
 *  1. 目标库由 `E2E_DB_FILE` 指定（默认落在会话中间产物目录），**绝不写入 public/data/data.db**。
 *  2. 先执行 server/db/schema.sql（含站点 SEO / 友情链接种子），再清空业务表并写入确定性 fixture。
 *  3. fixture 覆盖：4 场演唱会（点赞数 5/3/1/0 形成热点档位）、4 个城市、2 条许愿、
 *     图片 / 标签 / 歌单 / 视频、以及 3 条「恶意 href」友情链接（伪协议白名单的 E2E 验证面）。
 *  4. 幂等：可重复执行，每次结果一致。
 *
 *  Fixture highlights: 4 concerts (likes 5/3/1/0 → 3 hot tiers), 4 cities, 2 wishes, images/tags/songlist/video,
 *  plus 3 malicious friend-link hrefs (javascript:/data:/protocol-relative) to exercise the protocol allow-list.
 */
import { createClient } from '@libsql/client'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../..')

const dbFile =
  process.env.E2E_DB_FILE || path.join(process.env.TEMP || '.', 'ilive-e2e', 'e2e-data.db')
mkdirSync(path.dirname(dbFile), { recursive: true })
const url = 'file:' + dbFile.replace(/\\/g, '/')

const client = createClient({ url })

/** 多语言 JSON 简写 · i18n JSON shorthand */
const i18n = (zh, en, hant) =>
  JSON.stringify({ 'zh-CN': zh, en, 'zh-Hant': hant ?? zh })
/** 数组型多语言 JSON（tags）· array-shaped i18n JSON */
const i18nArr = (zh, en, hant) =>
  JSON.stringify({ 'zh-CN': zh, en, 'zh-Hant': hant ?? zh })

const XSS_DESC = '<b>经典现场</b><script>window.__xssDesc = 1</script><img src=x onerror="window.__xssDesc2 = 1">'
const XSS_NAME = '经典演唱会</script><script>window.__xssJsonLd = 1</script>'

const SCHEMA = readFileSync(path.join(projectRoot, 'server/db/schema.sql'), 'utf8')

const BUSINESS_TABLES = [
  'concert_likes',
  'concert_songlist',
  'concert_images',
  'concert_tags',
  'concerts',
  'cities',
  'wishes',
  'friend_links'
]

async function main() {
  // 1) schema（幂等，含站点 SEO / 站点设置 / 友情链接种子）
  await client.executeMultiple(SCHEMA)

  // 2) 清空业务表
  for (const table of BUSINESS_TABLES) {
    await client.execute(`DELETE FROM ${table}`)
  }

  // 3) 演唱会（点赞数 5 / 3 / 1 / 0 → pickHotConcertIds 恰好三档）
  const concerts = [
    {
      id: 1,
      artist: i18n('五月天', 'Mayday', '五月天'),
      name: i18n('诺亚方舟巡回演唱会', 'Noah Ark World Tour', '諾亞方舟巡迴演唱會'),
      theme: i18n('重返鸟巢', 'Back to the Bird Nest', '重返鳥巢'),
      country: i18n('中国', 'China', '中國'),
      province: i18n('北京', 'Beijing', '北京'),
      city: i18n('北京', 'Beijing', '北京'),
      venue: i18n('国家体育场', 'National Stadium', '國家體育場'),
      seat: i18n('A区 12排', 'Section A, Row 12', 'A區 12排'),
      price: i18n('¥1280', 'CNY 1280', '¥1280'),
      date: '2026-05-01',
      time: '19:30',
      poster: '/img/logo.jpg',
      description: i18n(XSS_DESC, XSS_DESC, XSS_DESC),
      video: i18n('五月天 - 诺亚方舟', 'Mayday - Noah Ark', '五月天 - 諾亞方舟'),
      videoUrl: i18n('/concert/20160903/01.jpg', '/concert/20160903/01.jpg', '/concert/20160903/01.jpg'),
      seq: 1,
      likes: 3
    },
    {
      id: 2,
      artist: i18n('周杰伦', 'Jay Chou', '周杰倫'),
      name: i18n('嘉年华世界巡回演唱会', 'Carnival World Tour', '嘉年華世界巡迴演唱會'),
      theme: i18n('青春回忆', 'Youth Memories', '青春回憶'),
      country: i18n('中国', 'China', '中國'),
      province: i18n('上海', 'Shanghai', '上海'),
      city: i18n('上海', 'Shanghai', '上海'),
      venue: i18n('梅赛德斯-奔驰文化中心', 'Mercedes-Benz Arena', '梅賽德斯-奔馳文化中心'),
      seat: i18n('B区 5排', 'Section B, Row 5', 'B區 5排'),
      price: i18n('¥980', 'CNY 980', '¥980'),
      date: '2025-11-15',
      time: '20:00',
      poster: '/img/logo.jpg',
      description: i18n('精彩演出', 'Great show', '精彩演出'),
      video: null,
      videoUrl: null,
      seq: 2,
      likes: 5
    },
    {
      id: 3,
      artist: i18n('张学友', 'Jacky Cheung', '張學友'),
      name: i18n(XSS_NAME, XSS_NAME, XSS_NAME),
      theme: i18n('经典重现', 'Classics', '經典重現'),
      country: i18n('中国', 'China', '中國'),
      province: i18n('广东', 'Guangdong', '廣東'),
      city: i18n('广州', 'Guangzhou', '廣州'),
      venue: i18n('广州体育馆', 'Guangzhou Gymnasium', '廣州體育館'),
      seat: null,
      price: null,
      date: '2024-08-20',
      time: '19:00',
      poster: '/img/logo.jpg',
      description: null,
      video: null,
      videoUrl: null,
      seq: 3,
      likes: 1
    },
    {
      id: 4,
      artist: i18n('陈奕迅', 'Eason Chan', '陳奕迅'),
      name: i18n('FEAR AND DREAMS', 'FEAR AND DREAMS', 'FEAR AND DREAMS'),
      theme: null,
      country: i18n('中国', 'China', '中國'),
      province: i18n('四川', 'Sichuan', '四川'),
      city: i18n('成都', 'Chengdu', '成都'),
      venue: i18n('成都东安湖体育公园', 'Dong’an Lake Sports Park', '成都東安湖體育公園'),
      seat: null,
      price: null,
      date: '2024-03-10',
      time: '19:30',
      poster: '/img/logo.jpg',
      description: i18n('无图无歌单场次', 'No images / no songlist', '無圖無歌單場次'),
      video: null,
      videoUrl: null,
      seq: 4,
      likes: 0
    }
  ]

  for (const c of concerts) {
    await client.execute({
      sql: `INSERT INTO concerts (id, artist_i18n, concert_name_i18n, theme_i18n, country_i18n,
              province_i18n, city_i18n, venue_i18n, seat_i18n, price_i18n, date, time, poster,
              description_i18n, video_i18n, video_url_i18n, seq, likes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        c.id, c.artist, c.name, c.theme, c.country, c.province, c.city, c.venue, c.seat, c.price,
        c.date, c.time, c.poster, c.description, c.video, c.videoUrl, c.seq, c.likes
      ]
    })
  }

  // 4) 标签 / 图片 / 歌单
  const tags = [
    [1, i18nArr(['摇滚', '现场'], ['Rock', 'Live'], ['搖滾', '現場']), 1],
    [2, i18nArr(['流行'], ['Pop'], ['流行']), 1],
    [3, i18nArr(['经典'], ['Classic'], ['經典']), 1]
  ]
  for (const [cid, value, seq] of tags) {
    await client.execute({
      sql: 'INSERT INTO concert_tags (concert_id, i18n, seq) VALUES (?,?,?)',
      args: [cid, value, seq]
    })
  }

  const images = [
    [1, '/concert/20160903/01.jpg', i18n('现场图一', 'Photo 1', '現場圖一'), 1],
    [1, '/concert/20160903/02.jpg', i18n('现场图二', 'Photo 2', '現場圖二'), 2],
    [2, '/concert/20160903/03.jpg', i18n('现场图三', 'Photo 3', '現場圖三'), 1]
  ]
  for (const [cid, imageUrl, alt, order] of images) {
    await client.execute({
      sql: 'INSERT INTO concert_images (concert_id, url, alt_i18n, sort_order) VALUES (?,?,?,?)',
      args: [cid, imageUrl, alt, order]
    })
  }

  const songs = [
    [1, i18n('倔强', 'Stubborn', '倔強'), 'https://www.bilibili.com/video/BV1xx411c7mD', 1],
    [1, i18n('温柔', 'Tenderness', '溫柔'), null, 2],
    [1, i18n('突然好想你', 'Suddenly Missing You', '突然好想你'), null, 3],
    [2, i18n('晴天', 'Sunny Day', '晴天'), null, 1],
    [2, i18n('七里香', 'Common Jasmine Orange', '七里香'), null, 2]
  ]
  for (const [cid, name, link, seq] of songs) {
    await client.execute({
      sql: 'INSERT INTO concert_songlist (concert_id, i18n, link, seq) VALUES (?,?,?,?)',
      args: [cid, name, link, seq]
    })
  }

  // 5) 城市 / 许愿
  const cities = [
    [1, i18n('中国'), i18n('北京', 'Beijing', '北京'), 1, '🏙️'],
    [2, i18n('中国'), i18n('上海', 'Shanghai', '上海'), 2, '🌆'],
    [3, i18n('中国'), i18n('广州', 'Guangzhou', '廣州'), 3, '🌃'],
    [4, i18n('中国'), i18n('成都', 'Chengdu', '成都'), 4, '🐼']
  ]
  for (const [id, country, name, seq, icon] of cities) {
    await client.execute({
      sql: 'INSERT INTO cities (id, country_i18n, name_i18n, seq, icon) VALUES (?,?,?,?,?)',
      args: [id, country, name, seq, icon]
    })
  }

  const wishes = [
    [1, i18n('希望看到更多演唱会', 'Hope to see more concerts', '希望看到更多演唱會'), 3, 1],
    [2, i18n('想去看一场五月天', 'Want to watch Mayday live', '想去看一場五月天'), 0, 0]
  ]
  for (const [id, content, likes, liked] of wishes) {
    await client.execute({
      sql: 'INSERT INTO wishes (id, content_i18n, likes, liked) VALUES (?,?,?,?)',
      args: [id, content, likes, liked]
    })
  }

  // 6) 友情链接：2 条正常 + 3 条恶意（伪协议 / data: / 协议相对）→ 验证服务端协议白名单过滤
  const links = [
    ['https://www.lyc.la', 'fas fa-globe', i18n('lyc.la', 'lyc.la', 'lyc.la'), 1],
    ['https://github.com/layicr/ilive_neo', 'fab fa-github', i18n('GitHub', 'GitHub', 'GitHub'), 2],
    ['javascript:alert(document.domain)', 'fas fa-bug', i18n('恶意链接JS', 'Bad JS', '惡意連結JS'), 90],
    ['data:text/html,<script>window.__xssHref=1</script>', 'fas fa-bug', i18n('恶意链接Data', 'Bad Data', '惡意連結Data'), 91],
    ['//evil.example.com', 'fas fa-bug', i18n('协议相对链接', 'Protocol relative', '協議相對連結'), 92]
  ]
  for (const [href, icon, title, seq] of links) {
    await client.execute({
      sql: 'INSERT INTO friend_links (href, icon, title_i18n, description_i18n, seq, enabled) VALUES (?,?,?,?,?,1)',
      args: [href, icon, title, null, seq]
    })
  }

  const counts = {}
  for (const table of [...BUSINESS_TABLES, 'site_settings', 'site_seo_i18n']) {
    const res = await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)
    counts[table] = Number(res.rows[0].n)
  }
  console.log('[e2e-seed] 测试库已就绪 / fixture DB ready:', JSON.stringify({ dbFile, counts }))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[e2e-seed] 种子失败 / seed failed:', err)
    process.exit(1)
  })
