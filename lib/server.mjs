/**
 * 简易数据管理服务 · Simple admin server
 *
 * 提供 REST API + 可视化增删改查界面，零第三方依赖。
 * REST API + a visual CRUD page, with zero third-party dependencies.
 *
 * 启动 · start:
 *   node lib/server.mjs
 *   PORT=9000 node lib/server.mjs        # 自定义端口 · custom port
 *   DB_PATH=./other.db node lib/server.mjs
 *
 * 接口 · REST API:
 *   GET    /                      管理总览界面 · admin overview page
 *   GET    /<table>.html          单表管理页面（如 /concerts.html）
 *   GET    /api/tables           表清单 · table list
 *   GET    /api/:table           列表 · list      (?limit=&offset=)
 *   GET    /api/:table/:id        详情 · get one
 *   POST   /api/:table           新增 · create
 *   PUT    /api/:table/:id        编辑 · update
 *   DELETE /api/:table/:id        删除 · delete
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DB_PATH, initSchema } from './db.mjs';
import {
  listTables, listRows, getRow, createRow, updateRow, deleteRow,
} from './crud.mjs';

const PORT = Number(process.env.PORT) || 8787;

// 静态资源（按需从磁盘读取，改动即时生效，无需重启）· static assets, read per request
const STATIC_ASSETS = {
  'admin.css': { file: 'admin.css', type: 'text/css; charset=utf-8' },
  'admin.js': { file: 'admin.js', type: 'application/javascript; charset=utf-8' },
};

/** 输出 JSON 响应 · send a JSON response */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

/** 从磁盘读取并输出静态文件，失败回 404 · read & serve a static file, fall back to 404 */
function serveStatic(res, relName, type) {
  try {
    const buf = readFileSync(fileURLToPath(new URL('../' + relName, import.meta.url)));
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    return res.end(buf);
  } catch {
    return sendJson(res, 404, { error: 'not found' });
  }
}

/**
 * 构造「客户端错误」（显式标记 HTTP 400）· build a client error carrying status 400
 * 显式标记比按错误文本猜状态码更可靠 · explicit tagging beats guessing from message text
 * @param {string} message 错误信息 · error message
 * @returns {Error} 带 status 字段的错误 · error with a `status` field
 */
function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

/** 读取并解析请求体 · read & parse the request body */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  // 去掉可能的 UTF-8 BOM（可能多个）· strip possible UTF-8 BOM(s)
  const raw = Buffer.concat(chunks).toString('utf8').replace(/^(\uFEFF)+/, '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('请求体不是合法 JSON · request body is not valid JSON');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const method = req.method || 'GET';

  try {
    /* 管理总览界面 · admin overview page */
    if (method === 'GET' && (seg.length === 0 || seg[0] === 'index.html')) {
      return serveStatic(res, 'admin.html', 'text/html; charset=utf-8');
    }

    /* 静态资源 · static assets（admin.css / admin.js / 各表 *.html）*/
    if (method === 'GET' && seg.length === 1) {
      const name = seg[0];
      if (STATIC_ASSETS[name]) return serveStatic(res, STATIC_ASSETS[name].file, STATIC_ASSETS[name].type);
      if (name.endsWith('.html')) return serveStatic(res, name, 'text/html; charset=utf-8');
    }

    if (seg[0] !== 'api') return sendJson(res, 404, { error: 'not found' });

    /* GET /api/tables */
    if (method === 'GET' && seg[1] === 'tables' && !seg[2]) {
      return sendJson(res, 200, { db: DB_PATH, tables: listTables() });
    }

    const table = seg[1];
    const id = seg[2];
    if (!table) return sendJson(res, 404, { error: 'not found' });

    /* 列表 · list */
    if (method === 'GET' && !id) {
      return sendJson(res, 200, await listRows(table, {
        limit: url.searchParams.get('limit'),
        offset: url.searchParams.get('offset'),
        q: url.searchParams.get('q'),
      }));
    }

    /* 详情 · get one */
    if (method === 'GET' && id) {
      const row = await getRow(table, id);
      if (!row) return sendJson(res, 404, { error: `记录不存在 · not found: ${table}#${id}` });
      return sendJson(res, 200, { row });
    }

    /* 新增 · create */
    if (method === 'POST' && !id) {
      return sendJson(res, 201, { row: await createRow(table, await readBody(req)) });
    }

    /* 编辑 · update */
    if ((method === 'PUT' || method === 'PATCH') && id) {
      return sendJson(res, 200, { row: await updateRow(table, id, await readBody(req)) });
    }

    /* 删除 · delete */
    if (method === 'DELETE' && id) {
      return sendJson(res, 200, await deleteRow(table, id));
    }

    return sendJson(res, 405, { error: `不支持的请求 · unsupported: ${method} ${url.pathname}` });
  } catch (e) {
    // 优先采用错误自带的 status（如请求体 JSON 解析失败），
    // 否则按校验类文案判定 400，其余视为服务端错误 500。
    // Prefer an explicit error.status (e.g. malformed JSON body); otherwise fall back to a
    // validation-message heuristic for 400, and 500 for anything else.
    const isValidation = /缺少|不可为空|不存在|未知表|不合法|不是合法|需要整数|单行表|唯一|约束|no field|invalid|missing|not found|constraint/i
      .test(e.message || '');
    const status = Number(e.status) || (isValidation ? 400 : 500);
    return sendJson(res, status, { error: e.message });
  }
});

// 先建表 / 写入种子（远程 Turso 也是异步），再监听端口
// Apply schema (async for remote Turso too) before listening
await initSchema();
server.listen(PORT, () => {
  console.log('数据管理服务已启动 · admin server running');
  console.log(`  总览 · overview : http://localhost:${PORT}`);
  console.log(`  单表页面 · table : http://localhost:${PORT}/concerts.html`);
  console.log(`  接口 · api      : http://localhost:${PORT}/api/tables`);
  console.log(`  数据库 · db     : ${DB_PATH}`);
});
