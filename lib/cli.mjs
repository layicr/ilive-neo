/**
 * 命令行增删改查 · CLI CRUD
 *
 * 用法 · usage:
 *   node lib/cli.mjs init
 *   node lib/cli.mjs tables
 *   node lib/cli.mjs list   <table> [--limit N] [--offset N]
 *   node lib/cli.mjs get    <table> <id>
 *   node lib/cli.mjs add    <table> '<json>' | --file data.json
 *   node lib/cli.mjs update <table> <id> '<json>' | --file data.json
 *   node lib/cli.mjs delete <table> <id>
 *
 * JSON 入参三种写法（Windows 下推荐 --file，避免引号转义与编码问题）:
 * Pass the JSON payload in three ways (prefer --file on Windows):
 *   1) 位置参数 · inline : add cities '{"name_i18n":{"zh-CN":"上海"}}'
 *      Windows PowerShell 会吞掉参数里的双引号，需改用 --file 或 stdin。
 *      Windows PowerShell strips double quotes from arguments, so use --file or stdin there.
 *   2) 文件     · file    : add cities --file payload.json        ← Windows 推荐 · recommended
 *   3) 标准输入 · stdin   : add cities -   < payload.json
 *      Windows PowerShell 管道需先设 UTF-8，否则中文乱码：
 *      On Windows PowerShell set UTF-8 first, otherwise CJK text is garbled:
 *        [Console]::OutputEncoding=[Text.Encoding]::UTF8
 *        Get-Content payload.json -Raw -Encoding UTF8 | node lib/cli.mjs add cities -
 *
 * 示例 · examples:
 *   node lib/cli.mjs list cities
 *   node lib/cli.mjs update cities 1 '{"seq":9}'
 *   node lib/cli.mjs delete cities 1
 */
import { readFileSync } from 'node:fs';
import { DB_PATH, initSchema, closeDb } from './db.mjs';
import {
  TABLES, listTables, listRows, getRow, createRow, updateRow, deleteRow,
} from './crud.mjs';

/**
 * 展开 i18n 字段便于阅读 · expand i18n JSON columns for readability
 * 库里存的是 JSON 字符串，直接打印会是一堆转义噪音，这里转成真实对象。
 * @param {string} table 表名
 * @param {*} data 单行 / 列表结果
 * @returns {*} 展开后的数据（--raw 时原样返回）
 */
function beautify(table, data) {
  const c = TABLES[table];
  if (!c || c.jsonFields.length === 0 || process.argv.includes('--raw')) return data;

  const fix = (row) => {
    if (!row || typeof row !== 'object') return row;
    const o = { ...row };
    for (const f of c.jsonFields) {
      if (typeof o[f] === 'string') {
        try { o[f] = JSON.parse(o[f]); } catch { /* 保留原始值 */ }
      }
    }
    return o;
  };

  if (Array.isArray(data)) return data.map(fix);
  if (data && Array.isArray(data.rows)) return { ...data, rows: data.rows.map(fix) };
  return fix(data);
}

/**
 * 打印结果 · print the result
 * 说明行走 stderr、JSON 走 stdout —— stdout 保持纯 JSON，方便管道处理：
 * Label goes to stderr and JSON to stdout, keeping stdout pipe-friendly:
 *   node cli.mjs list cities | jq '.total'
 * @param {string} label 说明文字（可空）· label text (optional)
 * @param {*} data 要输出的数据 · payload
 */
function out(label, data) {
  if (label) console.error(label);
  console.log(JSON.stringify(data, null, 2));
}

/**
 * 解析命令行参数：分离 --flag 与位置参数
 * Split `--flag value` options from positional arguments
 * @param {string[]} args 参数列表
 * @returns {{flags:object, pos:string[]}} 选项与位置参数
 */
function parseArgs(args) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--limit') flags.limit = args[++i];
    else if (a === '--offset') flags.offset = args[++i];
    else if (a === '--file' || a === '-f') flags.file = args[++i];
    else pos.push(a);
  }
  return { flags, pos };
}

/** 解析 JSON 文本 · parse JSON text */
function parseJson(raw, source) {
  if (!raw || !raw.trim()) throw new Error(`缺少 ${source} · missing ${source}`);
  // 去掉 UTF-8 BOM（PowerShell 管道可能输出多个 BOM）· strip BOM(s) — PowerShell may emit several
  const text = raw.replace(/^(\uFEFF)+/, '');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${source} 不是合法 JSON · not valid JSON: ${e.message}`);
  }
}

/**
 * 读取 JSON 入参：--file 文件 > stdin（`-`）> 位置参数
 * @param {string|undefined} inline 位置参数中的 JSON
 * @param {string|undefined} file --file 指定的文件路径
 * @returns {object} 解析后的对象
 */
function readPayload(inline, file) {
  if (file) return parseJson(readFileSync(file, 'utf8'), `文件 ${file}`);
  if (inline === '-') return parseJson(readFileSync(0, 'utf8'), 'stdin');
  return parseJson(inline, '入参 json');
}

/** 打印用法 · print usage */
function usage() {
  console.log(`iLive 数据管理 · CLI

用法 · usage:
  node lib/cli.mjs init
  node lib/cli.mjs tables
  node lib/cli.mjs list   <table> [--limit N] [--offset N]
  node lib/cli.mjs get    <table> <id>
  node lib/cli.mjs add    <table> '<json>' | --file data.json
  node lib/cli.mjs update <table> <id> '<json>' | --file data.json
  node lib/cli.mjs delete <table> <id>

JSON 入参 · payload: 位置参数 '<json>' | --file data.json | '-'（stdin）
  提示 · tip: Windows 下推荐 --file，可避免引号转义与中文乱码。

可用表 · tables:
${Object.entries(TABLES).map(([n, c]) => `  ${n.padEnd(18)} ${c.label}`).join('\n')}

数据库 · db: ${DB_PATH}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, pos } = parseArgs(rest);

  switch (cmd) {
    case 'init':
      await initSchema();
      return out('建表完成 · schema applied', { db: DB_PATH });

    case 'tables':
      return out('表清单 · tables', { db: DB_PATH, tables: listTables() });

    case 'list': {
      if (!pos[0]) throw new Error('缺少表名 · missing table');
      const r = await listRows(pos[0], { limit: flags.limit, offset: flags.offset });
      return out(`列表 · list: ${pos[0]}`, beautify(pos[0], r));
    }

    case 'get':
      if (!pos[0]) throw new Error('缺少表名 · missing table');
      return out(`详情 · get: ${pos[0]}#${pos[1]}`, beautify(pos[0], await getRow(pos[0], pos[1])));

    case 'add':
      if (!pos[0]) throw new Error('缺少表名 · missing table');
      return out('新增 · created', beautify(pos[0], await createRow(pos[0], readPayload(pos[1], flags.file))));

    case 'update':
      if (!pos[0]) throw new Error('缺少表名 · missing table');
      return out('更新 · updated', beautify(pos[0], await updateRow(pos[0], pos[1], readPayload(pos[2], flags.file))));

    case 'delete': {
      if (!pos[0]) throw new Error('缺少表名 · missing table');
      const r = await deleteRow(pos[0], pos[1]);
      const affected = Object.entries(r.cascade || {}).filter(([, n]) => n > 0);
      const extra = affected.length
        ? `（级联清理 cascade: ${affected.map(([t, n]) => `${t} × ${n}`).join(', ')}）`
        : '';
      return out(`删除 · deleted ${r.deleted} 条${extra}`, beautify(pos[0], r.row));
    }

    default:
      usage();
      process.exit(cmd ? 1 : 0);
  }
}

try {
  await main();
} catch (e) {
  console.error(`\n错误 · error: ${e.message}`);
  process.exit(1);
} finally {
  await closeDb();
}
