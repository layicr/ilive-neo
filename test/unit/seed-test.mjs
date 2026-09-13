/**
 * 本地测试数据构造（仅用于验证多语言管线）· Local test data (verify i18n pipeline only)
 * 用全新 schema 建 test-data.db 并插入样例数据；zh-Hant 故意留空以验证回退链。
 * Builds test-data.db with a fresh schema and inserts sample rows; zh-Hant is left empty on purpose
 * to exercise the fallback chain.
 */
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA = readFileSync(join(__dirname, 'server/db/schema.sql'), 'utf8')
const client = createClient({ url: 'file:./test-data.db' })

// 建表 · create tables
const stmts = SCHEMA.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(s => s.length > 0)
for (const s of stmts) await client.execute(s)

const zh = (z, e, h = z) => JSON.stringify({ zh: z, en: e, 'zh-Hant': h })

// 演唱会 1：五月天
await client.execute({
  sql: `INSERT INTO concerts (artist_i18n, concert_name_i18n, theme_i18n, country_i18n, province_i18n, city_i18n, venue_i18n, seat_i18n, price_i18n, date, time, poster, description_i18n, video_i18n, video_url_i18n, seq)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [
    zh('五月天', 'Mayday'),
    zh('诺亚方舟演唱会', 'Noah\'s Ark World Tour'),
    zh('世界巡演', 'World Tour'),
    zh('中国', 'China'),
    zh('北京市', 'Beijing'),
    zh('北京', 'Beijing'),
    zh('国家体育场', 'National Stadium'),
    zh('内场', 'Inner'),
    zh('580-1280元', 'RMB 580-1280'),
    '2026-10-01', '19:30', 'poster1.jpg',
    zh('五月天带你穿越诺亚方舟', 'Mayday takes you on Noah\'s Ark'),
    zh('官方MV', 'Official MV'), 'https://example.com/mv1', 1
  ]
})

// 演唱会 2：周杰伦
await client.execute({
  sql: `INSERT INTO concerts (artist_i18n, concert_name_i18n, theme_i18n, country_i18n, province_i18n, city_i18n, venue_i18n, seat_i18n, price_i18n, date, time, poster, description_i18n, video_i18n, video_url_i18n, seq)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [
    zh('周杰伦', 'Jay Chou'),
    zh('嘉年华演唱会', 'Carnival World Tour'),
    zh('世界巡演', 'World Tour'),
    zh('中国', 'China'),
    zh('上海市', 'Shanghai'),
    zh('上海', 'Shanghai'),
    zh('梅赛德斯奔驰文化中心', 'Mercedes-Benz Arena'),
    zh('看台', 'Grandstand'),
    zh('380-980元', 'RMB 380-980'),
    '2026-11-15', '20:00', 'poster2.jpg',
    zh('周杰伦嘉年华燃爆全场', 'Jay Chou Carnival lights up the arena'),
    zh('官方MV', 'Official MV'), 'https://example.com/mv2', 2
  ]
})

// tags
await client.execute({ sql: 'INSERT INTO concert_tags (concert_id, i18n, seq) VALUES (?,?,?)', args: [1, JSON.stringify({ zh: ['摇滚', '流行'], en: ['Rock', 'Pop'], 'zh-Hant': ['搖滾', '流行'] }), 0] })
await client.execute({ sql: 'INSERT INTO concert_tags (concert_id, i18n, seq) VALUES (?,?,?)', args: [2, JSON.stringify({ zh: ['流行'], en: ['Pop'], 'zh-Hant': ['流行'] }), 0] })

// images
await client.execute({ sql: 'INSERT INTO concert_images (concert_id, url, alt_i18n, sort_order) VALUES (?,?,?,?)', args: [1, 'img1.jpg', zh('现场照', 'Live photo'), 0] })

// songlist
await client.execute({ sql: 'INSERT INTO concert_songlist (concert_id, i18n, link, seq) VALUES (?,?,?,?)', args: [1, zh('温柔', 'Gentle'), 'https://example.com/s1', 0] })

// cities
await client.execute({ sql: 'INSERT INTO cities (country_i18n, name_i18n, seq, icon) VALUES (?,?,?,?)', args: [zh('中国', 'China'), zh('北京', 'Beijing'), 1, '🏙️'] })
await client.execute({ sql: 'INSERT INTO cities (country_i18n, name_i18n, seq, icon) VALUES (?,?,?,?)', args: [zh('中国', 'China'), zh('上海', 'Shanghai'), 2, '🌆'] })

// wishes
await client.execute({ sql: 'INSERT INTO wishes (content_i18n, likes, liked) VALUES (?,?,?)', args: [zh('希望五月天来我的城市开演唱会', 'Hope Mayday comes to my city'), 5, 0] })

console.log('[seed-test] 已写入测试数据 · test data written to test-data.db')
client.close()
