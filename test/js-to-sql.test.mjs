/**
 * js-to-sql.mjs 单元测试 · Unit tests for concert JS → SQL conversion
 *
 * 运行：node --test test/js-to-sql.test.mjs
 * 覆盖：parseLocation / sq / extractObject / generateSql 核心逻辑
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocation,
  sq,
  extractObject,
  generateSql,
} from '../js-to-sql.mjs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixtures = join(__dirname, 'fixtures');

/* ---------- parseLocation ---------- */

test('parseLocation: 中文含国家 → 四段拆分', () => {
  const r = parseLocation('中国 · 陕西 · 西安 · 陕西省体育场', 'zh');
  assert.equal(r.country, '中国');
  assert.equal(r.province, '陕西');
  assert.equal(r.city, '西安');
  assert.equal(r.venue, '陕西省体育场');
});

test('parseLocation: 英文含国家', () => {
  const r = parseLocation('China · Shaanxi · Xi\'an · Shaanxi Provincial Stadium', 'en');
  assert.equal(r.country, 'China');
  assert.equal(r.province, 'Shaanxi');
  assert.equal(r.city, 'Xi\'an');
  assert.equal(r.venue, 'Shaanxi Provincial Stadium');
});

test('parseLocation: 缺失国家 → 国家为空，剩余按省/市/场馆', () => {
  const r = parseLocation('广东 · 广州 · 广州体育馆', 'zh');
  assert.equal(r.country, '');
  assert.equal(r.province, '广东');
  assert.equal(r.city, '广州');
  assert.equal(r.venue, '广州体育馆');
});

test('parseLocation: 空字符串 → 全空', () => {
  const r = parseLocation('', 'zh');
  assert.deepEqual(r, { country: '', province: '', city: '', venue: '' });
});

/* ---------- sq (SQL 转义) ---------- */

test('sq: null → NULL', () => {
  assert.equal(sq(null), 'NULL');
  assert.equal(sq(undefined), 'NULL');
});

test('sq: 单引号转义为双单引号', () => {
  assert.equal(sq('Xi\'an'), "'Xi''an'");
  assert.equal(sq('A\'s'), "'A''s'");
});

test('sq: 普通字符串加单引号包裹', () => {
  assert.equal(sq('Mayday'), "'Mayday'");
});

/* ---------- extractObject ---------- */

test('extractObject: 提取对象字面量', () => {
  const src = 'var concert = {\n  "id": 1,\n  "artist": { "zh": "五月天" }\n};';
  const obj = extractObject(src);
  assert.ok(obj.startsWith('{'));
  assert.ok(obj.trim().endsWith('}'));
});

/* ---------- generateSql: 集成测试（基于 fixtures） ---------- */

test('generateSql: valid.js → 生成 4 张表 INSERT 且数量正确', () => {
  const src = readFileSync(join(fixtures, 'valid.js'), 'utf8');
  const concert = new Function(`return (${extractObject(src)})`)();
  const sql = generateSql(concert);

  // 主表 1 行
  assert.match(sql, /INSERT INTO concerts \(/);
  assert.match(sql, /VALUES \(101, '周杰伦'/);
  // 标签 3 行
  const tagCount = (sql.match(/INSERT INTO concert_tags/g) || []).length;
  assert.equal(tagCount, 3);
  // 图片 2 行
  const imgCount = (sql.match(/INSERT INTO concert_images/g) || []).length;
  assert.equal(imgCount, 2);
  // 歌单 3 行
  const songCount = (sql.match(/INSERT INTO concert_songlist/g) || []).length;
  assert.equal(songCount, 3);
  // 国家正确
  assert.match(sql, /'中国', 'China'/);
});

test('generateSql: no-country.js → 国家自动补 中国/China', () => {
  const src = readFileSync(join(fixtures, 'no-country.js'), 'utf8');
  const concert = new Function(`return (${extractObject(src)})`)();
  const sql = generateSql(concert);
  // 国家缺失时补默认值
  assert.match(sql, /'中国', 'China'/);
  // 省市级仍正确
  assert.match(sql, /'广东', 'Guangdong'/);
});

test('generateSql: special-chars.js → 单引号正确转义', () => {
  const src = readFileSync(join(fixtures, 'special-chars.js'), 'utf8');
  const concert = new Function(`return (${extractObject(src)})`)();
  const sql = generateSql(concert);
  // 演唱会名 Angela's → Angela''s
  assert.match(sql, /'Angela''s Journey Tour'/);
  // 地点 Xi'an → Xi''an（英文）
  assert.match(sql, /'Xi''an'/);
  // 描述中的单引号被转义（英文以 '.' 结尾）
  assert.match(sql, /'Fans said: ''This is the best night''\.'/);
  // 中文描述中的单引号同样被转义
  assert.match(sql, /'歌迷说：''这是最棒的一夜''。'/);
  // 不应对单引号未转义导致引号不成对
  const quotes = (sql.match(/'/g) || []).length;
  assert.ok(quotes % 2 === 0, '引号总数应为偶数（成对）');
});

test('generateSql: 歌单 seq 从 1 连续递增', () => {
  const src = readFileSync(join(fixtures, 'valid.js'), 'utf8');
  const concert = new Function(`return (${extractObject(src)})`)();
  const sql = generateSql(concert);
  assert.match(sql, /\(101, 1, '稻香'/);
  assert.match(sql, /\(101, 2, '七里香'/);
  assert.match(sql, /\(101, 3, '晴天'/);
});
