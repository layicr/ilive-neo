/**
 * 数据层单元测试 · Unit tests for db.mjs + crud.mjs
 *
 * 运行 · run:
 *   node --test test/crud.test.mjs
 *
 * 说明 · notes:
 *   - 使用临时数据库（DB_PATH 指向系统临时目录），不触碰真实 db/data.db
 *     Tests use a temp DB (DB_PATH → OS temp dir) and never touch the real db/data.db.
 *   - DB_PATH 必须在 import db.mjs 之前设置，因此这里用动态 import。
 *     DB_PATH must be set BEFORE importing db.mjs, hence the dynamic imports below.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES = join(__dirname, 'fixtures');

/* 先指向临时库，再加载被测模块 · point to a temp DB first, then load the modules */
const tmpDir = mkdtempSync(join(tmpdir(), 'ilive-crud-'));
process.env.DB_PATH = join(tmpDir, 'test.db');

const db = await import('../lib/db.mjs');
const crud = await import('../lib/crud.mjs');

/** 读取测试案例 · load a test-case fixture */
const fx = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

/** 全部表（子表在前，便于按序清空）· every table, children first */
const ALL_TABLES = [
  'concert_likes', 'concert_tags', 'concert_images', 'concert_songlist', 'concerts',
  'cities', 'wishes', 'friend_links', 'site_seo_i18n', 'site_settings',
];

/** 清空数据并恢复种子 · wipe all rows, then restore the seeds */
async function reset() {
  const conn = db.getDb();
  for (const t of ALL_TABLES) conn.exec(`DELETE FROM ${t}`);
  await db.initSchema();
}

before(async () => {
  await db.initSchema();
});

beforeEach(async () => {
  await reset();
});

after(async () => {
  await db.closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

/* ==================== 结构与配置 · structure ==================== */

test('TABLES 覆盖 schema.sql 中的全部表', async () => {
  const actual = db
    .getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  assert.deepEqual(Object.keys(crud.TABLES).sort(), actual.sort());
  assert.equal(Object.keys(crud.TABLES).length, 10);
});

test('listTables 返回字段 / 必填 / JSON 字段等元信息', async () => {
  const list = crud.listTables();
  assert.equal(list.length, 10);

  const concerts = list.find((t) => t.name === 'concerts');
  assert.equal(concerts.primaryKey, 'id');
  assert.equal(concerts.autoIncrement, true);
  assert.ok(concerts.fields.includes('date'));
  assert.ok(concerts.jsonFields.includes('artist_i18n'));
  assert.ok(concerts.required.includes('date'));
  assert.ok(concerts.intFields.includes('concert_id'));

  const seo = list.find((t) => t.name === 'site_seo_i18n');
  assert.equal(seo.primaryKey, 'key');
  assert.equal(seo.autoIncrement, false);

  const settings = list.find((t) => t.name === 'site_settings');
  assert.equal(settings.singleRow, true);
});

test('每张表的每个字段都有非空中文标题', async () => {
  for (const [name, c] of Object.entries(crud.TABLES)) {
    for (const f of c.fields) {
      const title = c.fieldLabels[f];
      assert.equal(typeof title, 'string', `${name}.${f} 缺少中文标题`);
      assert.ok(title.trim().length > 0, `${name}.${f} 中文标题为空`);
    }
  }
});

test('fields 与 fieldLabels 键序一致且无重复', async () => {
  for (const [name, c] of Object.entries(crud.TABLES)) {
    assert.deepEqual(c.fields, Object.keys(c.fieldLabels), `${name}: fields 应与 fieldLabels 键序一致`);
    assert.equal(new Set(c.fields).size, c.fields.length, `${name}: 字段不应重复`);
  }
});

test('listTables 暴露 fieldLabels 供界面显示中文标题', async () => {
  const list = crud.listTables();
  for (const t of list) {
    assert.equal(typeof t.fieldLabels, 'object');
    assert.deepEqual(Object.keys(t.fieldLabels), t.fields);
  }
  const concerts = list.find((t) => t.name === 'concerts');
  assert.equal(concerts.fieldLabels.artist_i18n, '歌手');
  assert.equal(concerts.fieldLabels.concert_name_i18n, '演唱会名称');
  assert.equal(concerts.fieldLabels.date, '日期');
});

test('DB_PATH 采用环境变量指定的临时库', async () => {
  assert.equal(db.DB_PATH, process.env.DB_PATH);
  assert.ok(db.DB_PATH.includes('ilive-crud-'));
});

test('SCHEMA_PATH 指向 db/schema.sql 且文件存在', async () => {
  assert.equal(db.SCHEMA_PATH, join(ROOT, 'db', 'schema.sql'));
  assert.ok(existsSync(db.SCHEMA_PATH));
});

test('initSchema 幂等：重复执行不报错、种子不重复', async () => {
  const before = (await crud.listRows('friend_links')).total;
  await db.initSchema();
  await db.initSchema();
  assert.equal((await crud.listRows('friend_links')).total, before);
});

test('外键约束已开启（保证级联删除生效）', async () => {
  assert.equal(db.getDb().prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('getDb 返回同一实例（单例）', async () => {
  assert.equal(db.getDb(), db.getDb());
});

/* ==================== 新增 · create ==================== */

test('新增城市：i18n 对象写入并返回自增主键', async () => {
  const row = await crud.createRow('cities', fx('city-ok.json'));
  assert.ok(Number.isInteger(row.id));
  assert.equal(JSON.parse(row.name_i18n)['zh-CN'], '西安');
  assert.equal(JSON.parse(row.country_i18n).en, 'China');
  assert.equal(row.seq, 1);
  assert.equal(row.icon, '🏛');
});

test('新增演唱会（完整案例）：多语言字段可完整读回', async () => {
  const c = await crud.createRow('concerts', fx('concert-full.json'));
  assert.equal(JSON.parse(c.artist_i18n)['zh-CN'], '五月天');
  assert.equal(JSON.parse(c.concert_name_i18n).en, 'Just Rock It 2016');
  assert.equal(JSON.parse(c.venue_i18n)['zh-CN'], '陕西省体育场');
  assert.equal(JSON.parse(c.description_i18n).en, 'A hundred thousand people singing along.');
  assert.equal(c.date, '2016-09-03');
  assert.equal(c.time, '19:30');
  assert.equal(c.seq, 1);
});

test('新增标签（数组式 i18n）：各语言数组正常存储', async () => {
  const concert = await crud.createRow('concerts', fx('concert-min.json'));
  const tag = await crud.createRow('concert_tags', { ...fx('tag-array.json'), concert_id: concert.id });
  const i18n = JSON.parse(tag.i18n);
  assert.deepEqual(i18n['zh-CN'], ['五月天', '安可']);
  assert.deepEqual(i18n.en, ['Mayday', 'Encore']);
  assert.equal(tag.seq, 1);
});

test('新增友情链接：enabled 与多语言字段正常', async () => {
  const link = await crud.createRow('friend_links', fx('friend-link.json'));
  assert.equal(link.href, 'https://example.com/new');
  assert.equal(link.enabled, 1);
  assert.equal(JSON.parse(link.title_i18n)['zh-CN'], '示例站点');
  assert.equal(JSON.parse(link.description_i18n).en, 'Example link');
});

test('新增：i18n 传 JSON 字符串会被解析并压缩存储', async () => {
  const row = await crud.createRow('cities', { name_i18n: '{ "zh-CN" : "上海" , "en" : "Shanghai" }' });
  assert.equal(row.name_i18n, '{"zh-CN":"上海","en":"Shanghai"}');
});

test('新增：非法 JSON 抛错', async () => {
  await assert.rejects(
    async () => await crud.createRow('cities', { name_i18n: '{不是 json}' }),
    /不是合法 JSON/,
  );
});

test('新增：缺必填字段抛错（案例 city-missing-required.json）', async () => {
  await assert.rejects(
    async () => await crud.createRow('cities', fx('city-missing-required.json')),
    /缺少必填字段.*name_i18n/,
  );
});

test('新增：必填字段为空串抛错', async () => {
  await assert.rejects(async () => await crud.createRow('cities', { name_i18n: '   ' }), /不可为空/);
});

test('新增：整数字段字符串转数字、布尔转 0/1', async () => {
  const row = await crud.createRow('wishes', {
    content_i18n: { 'zh-CN': '想看演唱会' },
    likes: '7',
    liked: true,
  });
  assert.equal(row.likes, 7);
  assert.equal(row.liked, 1);
});

test('新增：非整数值写入整数字段抛错', async () => {
  await assert.rejects(
    async () => await crud.createRow('wishes', { content_i18n: { 'zh-CN': 'x' }, likes: 'abc' }),
    /需要整数/,
  );
});

test('新增：可选字段空串存为 NULL', async () => {
  const row = await crud.createRow('cities', { name_i18n: { 'zh-CN': '北京' }, icon: '', seq: 2 });
  assert.equal(row.icon, null);
});

test('新增：外键不存在给出友好错误', async () => {
  await assert.rejects(
    async () => await crud.createRow('concert_tags', { concert_id: 999, i18n: { 'zh-CN': ['x'] } }),
    /外键约束失败/,
  );
});

test('新增：唯一约束冲突给出友好错误', async () => {
  // friend_links 的种子数据已占用 https://www.lyc.la
  await assert.rejects(
    async () => await crud.createRow('friend_links', { href: 'https://www.lyc.la', title_i18n: { 'zh-CN': '重复' } }),
    /唯一约束冲突/,
  );
});

test('新增：单行表 site_settings 已有记录时被拒', async () => {
  await assert.rejects(async () => await crud.createRow('site_settings', { author: 'x' }), /单行表/);
});

test('新增：未知表抛错', async () => {
  await assert.rejects(async () => await crud.createRow('not_a_table', {}), /未知表/);
});

/* ==================== 查询 · read ==================== */

test('listRows 分页：total / limit / offset 与默认排序', async () => {
  for (let i = 1; i <= 5; i++) {
    await crud.createRow('cities', { name_i18n: { 'zh-CN': `城${i}` }, seq: i });
  }
  const all = await crud.listRows('cities');
  assert.equal(all.total, 5);
  assert.equal(all.limit, 200);

  const page = await crud.listRows('cities', { limit: 2, offset: 1 });
  assert.equal(page.limit, 2);
  assert.equal(page.offset, 1);
  assert.equal(page.rows.length, 2);
  // 默认按 seq 升序，offset=1 应跳过 seq=1
  assert.equal(JSON.parse(page.rows[0].name_i18n)['zh-CN'], '城2');
  assert.equal(JSON.parse(page.rows[1].name_i18n)['zh-CN'], '城3');
});

test('listRows 全字段搜索 q：匹配文本列与 i18n JSON、空结果、空 q 等价于无过滤', async () => {
  await crud.createRow('cities', { name_i18n: { 'zh-CN': '北京', en: 'Beijing' }, seq: 1, icon: 'a' });
  await crud.createRow('cities', { name_i18n: { 'zh-CN': '上海', en: 'Shanghai' }, seq: 2, icon: 'b' });
  await crud.createRow('cities', { name_i18n: { 'zh-CN': '广州', en: 'Guangzhou' }, seq: 3, icon: 'c' });

  const zh = await crud.listRows('cities', { q: '北京', limit: 200 });
  assert.equal(zh.total, 1);
  assert.equal(zh.rows.length, 1);
  assert.equal(JSON.parse(zh.rows[0].name_i18n)['zh-CN'], '北京');

  const en = await crud.listRows('cities', { q: 'Shanghai', limit: 200 });
  assert.equal(en.total, 1);
  assert.equal(JSON.parse(en.rows[0].name_i18n).en, 'Shanghai');

  const none = await crud.listRows('cities', { q: '火星', limit: 200 });
  assert.equal(none.total, 0);
  assert.equal(none.rows.length, 0);

  const empty = await crud.listRows('cities', { q: '', limit: 200 });
  assert.equal(empty.total, 3);
});

test('getRow：存在返回记录，不存在返回 null', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '广州' } });
  assert.equal((await crud.getRow('cities', city.id)).id, city.id);
  assert.equal(await crud.getRow('cities', 99999), null);
});

test('getRow：文本主键表 site_seo_i18n 可正常读取', async () => {
  const row = await crud.getRow('site_seo_i18n', 'site_title');
  assert.ok(row);
  assert.equal(JSON.parse(row.value_i18n).en, 'Layicr Concert Journey');
  assert.equal(await crud.getRow('site_seo_i18n', 'no_such_key'), null);
});

test('种子数据已按 schema.sql 写入', async () => {
  assert.equal((await crud.listRows('friend_links')).total, 9);
  assert.equal((await crud.listRows('site_seo_i18n')).total, 3);
  const s = await crud.getRow('site_settings', 1);
  assert.equal(s.site_url, 'https://ilive.lyc.la');
  assert.equal(s.robots, 'index, follow');
});

/* ==================== 编辑 · update ==================== */

test('updateRow：部分更新不影响其他字段', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '成都' }, seq: 1, icon: '🌶' });
  const updated = await crud.updateRow('cities', city.id, { seq: 9 });
  assert.equal(updated.seq, 9);
  assert.equal(updated.icon, '🌶');
  assert.equal(updated.name_i18n, city.name_i18n);
});

test('updateRow：空对象原样返回', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '杭州' } });
  assert.deepEqual(await crud.updateRow('cities', city.id, {}), city);
});

test('updateRow：主键不可修改（传入被忽略）', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '苏州' } });
  const updated = await crud.updateRow('cities', city.id, { id: 12345, seq: 3 });
  assert.equal(updated.id, city.id);
  assert.equal(updated.seq, 3);
});

test('updateRow：更新 i18n 字段', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '西安' } });
  const updated = await crud.updateRow('cities', city.id, { name_i18n: { 'zh-CN': '西安市', en: 'Xi an City' } });
  assert.equal(JSON.parse(updated.name_i18n)['zh-CN'], '西安市');
});

test('updateRow：记录不存在抛错', async () => {
  await assert.rejects(async () => await crud.updateRow('cities', 99999, { seq: 1 }), /记录不存在/);
});

test('updateRow：必填字段置空抛错', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '南京' } });
  await assert.rejects(async () => await crud.updateRow('cities', city.id, { name_i18n: '' }), /不可为空/);
});

test('updateRow：可选字段可置为 NULL', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '天津' }, icon: '🏙' });
  assert.equal((await crud.updateRow('cities', city.id, { icon: '' })).icon, null);
});

/* ==================== 删除 · delete ==================== */

test('deleteRow：返回删除条数与被删记录', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': '长沙' } });
  const result = await crud.deleteRow('cities', city.id);
  assert.equal(result.deleted, 1);
  assert.equal(result.row.id, city.id);
  assert.equal(await crud.getRow('cities', city.id), null);
});

test('deleteRow：记录不存在抛错', async () => {
  await assert.rejects(async () => await crud.deleteRow('cities', 99999), /记录不存在/);
});

test('deleteRow：删除演唱会级联清理 4 张子表', async () => {
  const concert = await crud.createRow('concerts', fx('concert-min.json'));
  await crud.createRow('concert_tags', { concert_id: concert.id, i18n: { 'zh-CN': ['a'] }, seq: 1 });
  await crud.createRow('concert_images', { concert_id: concert.id, url: 'a.jpg', sort_order: 1 });
  await crud.createRow('concert_songlist', { concert_id: concert.id, i18n: { 'zh-CN': '歌' }, seq: 1 });
  await crud.createRow('concert_likes', { concert_id: concert.id, ip: '1.1.1.1' });

  const result = await crud.deleteRow('concerts', concert.id);
  assert.equal(result.deleted, 1);
  assert.deepEqual(result.cascade, {
    concert_likes: 1,
    concert_tags: 1,
    concert_images: 1,
    concert_songlist: 1,
  });
  assert.equal((await crud.listRows('concert_tags')).total, 0);
  assert.equal((await crud.listRows('concert_images')).total, 0);
  assert.equal((await crud.listRows('concert_songlist')).total, 0);
  assert.equal((await crud.listRows('concert_likes')).total, 0);
});

test('deleteRow：演唱会无子表时 cascade 全为 0', async () => {
  const concert = await crud.createRow('concerts', fx('concert-min.json'));
  const result = await crud.deleteRow('concerts', concert.id);
  assert.deepEqual(result.cascade, {
    concert_likes: 0,
    concert_tags: 0,
    concert_images: 0,
    concert_songlist: 0,
  });
});

test('countChildren：无子表的表返回空对象', async () => {
  const city = await crud.createRow('cities', { name_i18n: { 'zh-CN': 'x' } });
  assert.deepEqual(await crud.countChildren('cities', city.id), {});
});
