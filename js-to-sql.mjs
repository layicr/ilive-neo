/**
 * concert*.js → SQL 转换脚本 · Convert concert JS files to SQL insert statements
 *
 * 用法 Usage:
 *   node js-to-sql.mjs concert1.js               # 转换单个文件 → concert1.sql
 *   node js-to-sql.mjs concert1.js concert2.js   # 转换多个文件
 *   node js-to-sql.mjs *.js                      # 转换该目录下所有 concert*.js
 *   node js-to-sql.mjs concert1.js -o out.sql    # 指定输出文件
 *
 * 说明：
 *   - 读取本目录下 concert*.js（如 concert.js / concert1.js，定义全局变量 concert / concertN，
 *     含 id/artist/concertName/theme/location/seat/price/date/tags/images/songlist）
 *   - 解析 location "国家 · 省 · 市 · 场馆" 拆分为 country/province/city/venue
 *     （中英分别解析，国家缺失时自动补"中国/China"）
 *   - 生成 concerts、concert_tags、concert_images、concert_songlist 的 INSERT SQL
 *   - 输出为 .sql 文件，可直接在 sqlite3 / turso shell / 客户端执行
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(new URL('.', import.meta.url)));

/* ---------- 工具函数 ---------- */

/* ---------- 工具函数 ---------- */

/**
 * SQL 字符串转义 · escape single quotes
 * @param {*} s 原始值 · raw value
 * @returns {string} SQL 字面量（null 返回 NULL，单引号转义为两个单引号）
 */
function sq(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/**
 * 移除外部 JS 包装，取对象字面量 · strip `var concert1 = {...};` → `{...}`
 * @param {string} source 源文件内容 · source file content
 * @returns {string} 对象字面量字符串
 */
function extractObject(source) {
  const match = source.match(/\{\s*[\s\S]*\}/);
  if (!match) throw new Error('未找到对象字面量 · cannot find object literal');
  return match[0];
}

/**
 * 解析 location 字符串 → 分段字段 · Parse location string into segments
 * @param {string} locStr 位置字符串（如 "中国 · 陕西 · 西安 · 陕西省体育场"）
 * @param {'zh'|'en'} lang 语言 key（当前仅用于区分国家名）
 * @returns {{country:string, province:string, city:string, venue:string}} 分段字段
 * @description 首位命中"中国/China"则识别为国家；剩余按 省·市·场馆 分配，场馆可缺省。
 */
function parseLocation(locStr, lang) {
  if (!locStr) return { country: '', province: '', city: '', venue: '' };
  const parts = locStr.split('·').map(p => p.trim()).filter(Boolean);
  // 中国大陆常见省/市：已知中国省市不在这里枚举，采用启发式：
  // 若首位是"中国"(zh) / "China"(en)，则为国家
  let country = '', province = '', city = '', venue = '';
  const countryNames = ['中国', 'China', '中國'];
  let idx = 0;
  if (countryNames.includes(parts[0])) {
    country = parts[0];
    idx = 1;
  }
  // 剩余按 省 · 市 · 场馆 分配（至少省、市；场馆可缺省）
  const rest = parts.slice(idx);
  province = rest[0] || '';
  city = rest[1] || '';
  venue = rest.slice(2).join(' · ') || '';
  return { country, province, city, venue };
}

/* ---------- 生成 SQL ---------- */

/**
 * 生成单场演唱会的 INSERT SQL 语句 · Generate INSERT SQL for one concert
 * @param {object} concert 演唱会对象（id/artist/concertName/.../songlist）
 * @returns {string} 多行 INSERT 语句（concerts + tags + images + songlist）
 */
function generateSql(concert) {
  const id = concert.id;
  const artistZh = concert.artist?.zh || '';
  const artistEn = concert.artist?.en || '';
  const nameZh = concert.concertName?.zh || '';
  const nameEn = concert.concertName?.en || '';
  const themeZh = concert.theme?.zh || '';
  const themeEn = concert.theme?.en || '';

  // location 拆分（中英文分别解析，国家默认中国/China 若缺失则补）
  const locZh = parseLocation(concert.location?.zh, 'zh');
  const locEn = parseLocation(concert.location?.en, 'en');
  const countryZh = locZh.country || '中国';
  const countryEn = locEn.country || 'China';

  const seatZh = concert.seat?.zh || '';
  const seatEn = concert.seat?.en || '';
  const priceZh = concert.price?.zh || '';
  const priceEn = concert.price?.en || '';
  const date = concert.date || '';
  const time = concert.time || '';
  const poster = concert.poster || '';
  const descZh = concert.description?.zh || '';
  const descEn = concert.description?.en || '';

  const lines = [];
  lines.push(`-- ============================================`);
  lines.push(`-- id:${id} ${artistZh} ${nameZh}`);
  lines.push(`-- ============================================`);

  // 1. concerts 主表
  lines.push(`INSERT INTO concerts (id, artist_zh, artist_en, concert_name_zh, concert_name_en, theme_zh, theme_en, country_zh, country_en, province_zh, province_en, city_zh, city_en, venue_zh, venue_en, seat_zh, seat_en, price_zh, price_en, date, time, poster, description_zh, description_en, video_zh, video_en, video_url_zh, video_url_en)
VALUES (${id}, ${sq(artistZh)}, ${sq(artistEn)}, ${sq(nameZh)}, ${sq(nameEn)}, ${sq(themeZh)}, ${sq(themeEn)}, ${sq(countryZh)}, ${sq(countryEn)}, ${sq(locZh.province)}, ${sq(locEn.province)}, ${sq(locZh.city)}, ${sq(locEn.city)}, ${sq(locZh.venue)}, ${sq(locEn.venue)}, ${sq(seatZh)}, ${sq(seatEn)}, ${sq(priceZh)}, ${sq(priceEn)}, ${sq(date)}, ${sq(time)}, ${sq(poster)}, ${sq(descZh)}, ${sq(descEn)}, NULL, NULL, NULL, NULL);`);

  // 2. concert_tags 标签
  const tagsZh = concert.tags?.zh || [];
  const tagsEn = concert.tags?.en || [];
  tagsZh.forEach((tz, i) => {
    const te = tagsEn[i] || tz;
    lines.push(`INSERT INTO concert_tags (concert_id, zh, en) VALUES (${id}, ${sq(tz)}, ${sq(te)});`);
  });

  // 3. concert_images 图片
  const images = concert.images || [];
  images.forEach(img => {
    const src = img.src || '';
    const altZh = img.alt?.zh || '';
    const altEn = img.alt?.en || '';
    lines.push(`INSERT INTO concert_images (concert_id, src, alt_zh, alt_en) VALUES (${id}, ${sq(src)}, ${sq(altZh)}, ${sq(altEn)});`);
  });

  // 4. concert_songlist 歌单
  const songs = concert.songlist || [];
  songs.forEach((s, i) => {
    lines.push(`INSERT INTO concert_songlist (concert_id, seq, zh, en, link) VALUES (${id}, ${i + 1}, ${sq(s.zh)}, ${sq(s.en)}, NULL);`);
  });

  lines.push('');
  return lines.join('\n');
}

/* ---------- 主流程 ---------- */

/**
 * 主流程：解析命令行参数 → 逐个文件生成 SQL → 写入输出文件
 * @description 用法：`node js-to-sql.mjs concert.js [concert2.js ...] [-o out.sql]`
 *              默认输出到本目录 `concerts.sql`。
 */
function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('-o');
  let outFile = null;
  let files = args;
  if (outIdx !== -1) {
    outFile = args[outIdx + 1];
    files = args.slice(0, outIdx).concat(args.slice(outIdx + 2));
  }
  // 支持通配 *.js —— 由 shell 展开，这里直接接收
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('js-to-sql'));

  if (jsFiles.length === 0) {
    console.error('用法 · usage: node js-to-sql.mjs concert1.js [concert2.js ...]');
    process.exit(1);
  }

  const allSql = [];
  allSql.push(`-- 由 concert*.js 自动生成的 INSERT SQL`);
  allSql.push(`-- 生成时间 · generated: ${new Date().toISOString()}`);
  allSql.push(`-- 建议先保证表结构已存在（schema.sql / 已有库）`);
  allSql.push(`-- 若需清空旧数据再插入，请先执行：`);
  allSql.push(`--   DELETE FROM concert_songlist; DELETE FROM concert_images; DELETE FROM concert_tags; DELETE FROM concerts;`);
  allSql.push('');

  for (const f of jsFiles) {
    const full = join(__dirname, f);
    try {
      const src = readFileSync(full, 'utf8');
      const objSrc = extractObject(src);
      // 用 Function 构造器把对象字面量变成真实对象
      const concert = new Function(`return (${objSrc})`)();
      allSql.push(generateSql(concert));
      console.log(`✅ ${f} → 生成 id:${concert.id} ${concert.artist?.zh} ${concert.concertName?.zh}`);
    } catch (e) {
      console.error(`❌ ${f} 失败 · failed:`, e.message);
    }
  }

  const outPath = outFile || join(__dirname, 'concerts.sql');
  writeFileSync(outPath, allSql.join('\n'), 'utf8');
  console.log(`\n✅ SQL 已写入 · written to: ${outPath}`);
}

// 支持作为模块被单元测试导入（仅在 CLI 直接运行时执行 main）
export { generateSql, parseLocation, sq, extractObject };

// 仅当以 `node js-to-sql.mjs ...` 直接运行时才执行主流程
import { argv } from 'node:process';
if (argv[1] && argv[1].endsWith('js-to-sql.mjs')) {
  main();
}
