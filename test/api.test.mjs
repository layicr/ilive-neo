/**
 * REST API 集成测试 · Integration tests for lib/server.mjs
 *
 * 运行 · run:
 *   node --test test/api.test.mjs
 *
 * 说明 · notes:
 *   - 会以子进程启动 lib/server.mjs，使用临时数据库与独立端口，不影响真实库与开发服务
 *     Spawns lib/server.mjs as a child process with a temp DB and a dedicated port,
 *     so neither the real DB nor a running dev server is affected.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES = join(__dirname, 'fixtures');

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;

const tmpDir = mkdtempSync(join(tmpdir(), 'ilive-api-'));
const DB_FILE = join(tmpDir, 'api.db');

let child = null;

/** 读取测试案例 · load a test-case fixture */
const fx = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

/** 发送 JSON 请求 · send a JSON request */
function send(method, path, body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** 轮询等待服务就绪 · poll until the server is ready */
async function waitReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/tables`);
      if (res.ok) return;
    } catch {
      /* 尚未监听，继续等待 · not listening yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`服务未在 ${timeoutMs}ms 内启动 · server did not start in time`);
}

before(async () => {
  child = spawn(process.execPath, [join(ROOT, 'lib/server.mjs')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: DB_FILE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  await waitReady();
});

after(async () => {
  if (child && !child.killed) child.kill();
  await new Promise((r) => setTimeout(r, 300));
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* Windows 上偶发文件占用，忽略清理失败 · ignore occasional lock on Windows */
  }
});

/* ==================== 静态与元信息 · static & meta ==================== */

test('GET / 返回管理页面', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /iLive 数据管理/);
  assert.match(html, /id="grid"/);
});

test('GET /api/tables 返回 10 张表与数据库路径', async () => {
  const res = await fetch(`${BASE}/api/tables`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tables.length, 10);
  assert.equal(body.db, DB_FILE);
  const names = body.tables.map((t) => t.name);
  assert.ok(names.includes('concerts'));
  assert.ok(names.includes('friend_links'));
});

/* ==================== 增删改查链路 · CRUD flow ==================== */

test('新增 → 列表 → 详情 → 编辑 → 删除 完整链路', async () => {
  /* 新增 · create */
  const created = await send('POST', '/api/cities', fx('city-ok.json'));
  assert.equal(created.status, 201);
  const { row } = await created.json();
  assert.ok(Number.isInteger(row.id));
  assert.equal(JSON.parse(row.name_i18n)['zh-CN'], '西安');
  assert.equal(row.icon, '🏛');

  /* 列表 · list */
  const list = await (await fetch(`${BASE}/api/cities`)).json();
  assert.equal(list.total, 1);
  assert.equal(list.rows.length, 1);

  /* 详情 · get one */
  const one = await (await fetch(`${BASE}/api/cities/${row.id}`)).json();
  assert.equal(one.row.id, row.id);

  /* 编辑 · update */
  const updated = await send('PUT', `/api/cities/${row.id}`, { seq: 42 });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).row.seq, 42);

  /* 删除 · delete */
  const deleted = await send('DELETE', `/api/cities/${row.id}`);
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted, 1);

  const empty = await (await fetch(`${BASE}/api/cities`)).json();
  assert.equal(empty.total, 0);
});

test('PATCH 与 PUT 等效', async () => {
  const { row } = await (await send('POST', '/api/cities', { name_i18n: { 'zh-CN': '上海' } })).json();
  const res = await send('PATCH', `/api/cities/${row.id}`, { seq: 7 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).row.seq, 7);
  await send('DELETE', `/api/cities/${row.id}`);
});

test('列表支持 limit 与 offset 分页', async () => {
  const ids = [];
  for (let i = 1; i <= 3; i++) {
    const { row } = await (await send('POST', '/api/cities', { name_i18n: { 'zh-CN': `城${i}` }, seq: i })).json();
    ids.push(row.id);
  }

  const page = await (await fetch(`${BASE}/api/cities?limit=2&offset=1`)).json();
  assert.equal(page.total, 3);
  assert.equal(page.limit, 2);
  assert.equal(page.offset, 1);
  assert.equal(page.rows.length, 2);
  assert.equal(JSON.parse(page.rows[0].name_i18n)['zh-CN'], '城2');

  for (const id of ids) await send('DELETE', `/api/cities/${id}`);
  assert.equal((await (await fetch(`${BASE}/api/cities`)).json()).total, 0);
});

test('列表支持 q 全字段搜索（含 i18n JSON）', async () => {
  const ids = [];
  for (const name of ['北京', '上海', '广州']) {
    const { row } = await (await send('POST', '/api/cities', { name_i18n: { 'zh-CN': name, en: name + 'En' }, seq: 1 })).json();
    ids.push(row.id);
  }

  const zh = await (await fetch(`${BASE}/api/cities?q=${encodeURIComponent('北京')}`)).json();
  assert.equal(zh.total, 1);
  assert.equal(zh.rows.length, 1);
  assert.equal(JSON.parse(zh.rows[0].name_i18n)['zh-CN'], '北京');

  const en = await (await fetch(`${BASE}/api/cities?q=${encodeURIComponent('上海En')}`)).json();
  assert.equal(en.total, 1);

  const none = await (await fetch(`${BASE}/api/cities?q=${encodeURIComponent('火星')}`)).json();
  assert.equal(none.total, 0);

  const empty = await (await fetch(`${BASE}/api/cities?q=`)).json();
  assert.equal(empty.total, 3);

  for (const id of ids) await send('DELETE', `/api/cities/${id}`);
});

test('删除演唱会返回级联清理统计', async () => {
  const { row: concert } = await (await send('POST', '/api/concerts', fx('concert-min.json'))).json();
  await send('POST', '/api/concert_tags', { ...fx('tag-array.json'), concert_id: concert.id });

  const res = await send('DELETE', `/api/concerts/${concert.id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.deleted, 1);
  assert.equal(body.cascade.concert_tags, 1);
  assert.equal((await (await fetch(`${BASE}/api/concert_tags`)).json()).total, 0);
});

/* ==================== 错误分支 · error branches ==================== */

test('详情：记录不存在返回 404', async () => {
  const res = await fetch(`${BASE}/api/cities/99999`);
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /记录不存在/);
});

test('新增：缺必填返回 400 与友好提示', async () => {
  const res = await send('POST', '/api/cities', fx('city-missing-required.json'));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /缺少必填字段/);
});

test('新增：非法 JSON 请求体返回 400', async () => {
  const res = await fetch(`${BASE}/api/cities`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{不是合法 json',
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /不是合法 JSON/);
});

test('新增：i18n 字段非法 JSON 返回 400', async () => {
  const res = await send('POST', '/api/cities', { name_i18n: '{坏掉的 json}' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /不是合法 JSON/);
});

test('新增：外键不存在返回 400', async () => {
  const res = await send('POST', '/api/concert_tags', { concert_id: 999, i18n: { 'zh-CN': ['x'] } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /外键约束失败/);
});

test('新增：唯一约束冲突返回 400', async () => {
  const res = await send('POST', '/api/friend_links', {
    href: 'https://www.lyc.la',
    title_i18n: { 'zh-CN': '重复' },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /唯一约束冲突/);
});

test('未知表返回 400', async () => {
  const res = await fetch(`${BASE}/api/not_a_table`);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /未知表/);
});

test('不支持的方法返回 405（DELETE 缺主键）', async () => {
  const res = await send('DELETE', '/api/cities');
  assert.equal(res.status, 405);
});

test('未知路径返回 404', async () => {
  const res = await fetch(`${BASE}/not-an-api`);
  assert.equal(res.status, 404);
});
