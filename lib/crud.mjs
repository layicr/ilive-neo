/**
 * 通用 CRUD 数据层 · Generic CRUD data layer
 *
 * 表定义与 `db/schema.sql` 一一对应，全部写操作走参数化 SQL，
 * 表名 / 字段名均来自本文件白名单，不存在拼接注入风险。
 *
 * All table definitions mirror `schema.sql`. Every write uses parameterized SQL,
 * and table/column names come from the whitelist below — no injection risk.
 *
 * 多语言约定 · i18n convention:
 *   `*_i18n` 字段存 JSON，如 {"zh-CN":"..","en":"..","zh-Hant":".."}
 */
import { initSchema, dbAll, dbGet, dbRun } from './db.mjs';

/** 整数类字段（写入前转数字）· integer columns (coerced before write) */
export const INT_FIELDS = new Set([
  'id', 'concert_id', 'seq', 'sort_order', 'likes', 'liked', 'enabled',
]);

/**
 * 表配置 · table definitions（与 schema.sql 保持一致）
 * @property {string} label        中文名（界面展示）· display name
 * @property {string} primaryKey   主键列 · primary key column
 * @property {boolean} autoIncrement 主键是否自增 · whether PK auto-increments
 * @property {boolean} [singleRow] 是否单行表（强制 id = 1）· single-row table
 * @property {string} order        默认排序 · default ORDER BY
 * @property {Record<string,string>} fieldLabels 字段中文标题（键序即字段顺序）· Chinese column titles (key order = column order)
 * @property {string[]} fields     可写字段（由 fieldLabels 派生）· writable columns, derived from fieldLabels
 * @property {string[]} required   必填字段 · required columns
 * @property {string[]} jsonFields 存 JSON 的字段 · JSON-encoded columns
 */
export const TABLES = {
  concerts: {
    label: '演唱会',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'seq, id',
    fieldLabels: {
      id: 'ID',
      artist_i18n: '歌手',
      concert_name_i18n: '演唱会名称',
      theme_i18n: '主题',
      country_i18n: '国家',
      province_i18n: '省份',
      city_i18n: '城市',
      venue_i18n: '场馆',
      seat_i18n: '座位',
      price_i18n: '票价',
      date: '日期',
      time: '时间',
      poster: '海报',
      description_i18n: '描述',
      video_i18n: '视频标题',
      video_url_i18n: '视频地址',
      seq: '排序',
      likes: '点赞数',
    },
    required: ['artist_i18n', 'concert_name_i18n', 'date', 'likes'],
    jsonFields: [
      'artist_i18n', 'concert_name_i18n', 'theme_i18n', 'country_i18n',
      'province_i18n', 'city_i18n', 'venue_i18n', 'seat_i18n', 'price_i18n',
      'description_i18n', 'video_i18n', 'video_url_i18n',
    ],
  },

  concert_likes: {
    label: '点赞',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'id',
    fieldLabels: {
      id: 'ID',
      concert_id: '演唱会 ID',
      ip: 'IP 地址',
      created_at: '点赞时间',
    },
    required: ['concert_id', 'ip'],
    jsonFields: [],
  },

  concert_tags: {
    label: '标签',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'seq, id',
    fieldLabels: {
      id: 'ID',
      concert_id: '演唱会 ID',
      i18n: '标签',
      seq: '排序',
    },
    required: ['concert_id', 'i18n'],
    jsonFields: ['i18n'],
  },

  concert_images: {
    label: '图片',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'sort_order, id',
    fieldLabels: {
      id: 'ID',
      concert_id: '演唱会 ID',
      url: '图片地址',
      alt_i18n: '替代文本',
      sort_order: '排序',
    },
    required: ['concert_id', 'url'],
    jsonFields: ['alt_i18n'],
  },

  concert_songlist: {
    label: '歌单',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'seq, id',
    fieldLabels: {
      id: 'ID',
      concert_id: '演唱会 ID',
      i18n: '歌曲名',
      link: '歌曲链接',
      seq: '排序',
    },
    required: ['concert_id', 'i18n'],
    jsonFields: ['i18n'],
  },

  cities: {
    label: '城市',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'seq, id',
    fieldLabels: {
      id: 'ID',
      country_i18n: '国家',
      name_i18n: '城市名',
      seq: '排序',
      icon: '图标',
    },
    required: ['name_i18n'],
    jsonFields: ['country_i18n', 'name_i18n'],
    emojiFields: ['icon'], // 图标列以 emoji 存储，管理端用图标选择器 · icon column stores an emoji
  },

  wishes: {
    label: '许愿',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'id',
    fieldLabels: {
      id: 'ID',
      content_i18n: '许愿内容',
      likes: '点赞数',
      liked: '已点赞',
    },
    required: ['content_i18n'],
    jsonFields: ['content_i18n'],
  },

  site_settings: {
    label: '站点设置',
    primaryKey: 'id',
    autoIncrement: false,
    singleRow: true,
    order: 'id',
    fieldLabels: {
      id: 'ID',
      og_image: 'OG 图地址',
      twitter_site: 'Twitter 账号',
      twitter_creator: 'Twitter 创建者',
      author: '作者',
      robots: '爬虫指令',
      site_url: '站点地址',
    },
    required: [],
    jsonFields: [],
  },

  site_seo_i18n: {
    label: 'SEO 文案',
    primaryKey: 'key',
    autoIncrement: false,
    order: 'key',
    fieldLabels: {
      key: '键名',
      value_i18n: '文案',
    },
    required: ['key', 'value_i18n'],
    jsonFields: ['value_i18n'],
  },

  friend_links: {
    label: '友情链接',
    primaryKey: 'id',
    autoIncrement: true,
    order: 'seq, id',
    fieldLabels: {
      id: 'ID',
      href: '链接地址',
      icon: '图标类名',
      title_i18n: '名称',
      description_i18n: '描述',
      seq: '排序',
      enabled: '启用状态',
    },
    required: ['href', 'title_i18n'],
    jsonFields: ['title_i18n', 'description_i18n'],
  },
};

// 字段列表由 fieldLabels 的键序派生：新增字段只需补一处，标题与列名不会各自漂移。
// Derive `fields` from the key order of `fieldLabels`, so adding a column means editing
// exactly one place and a column can never end up without a Chinese title.
for (const c of Object.values(TABLES)) {
  c.fields = Object.keys(c.fieldLabels);
}

/**
 * 取表配置（同时起到表名白名单校验作用）
 * @param {string} table 表名 · table name
 * @returns {object} 表配置
 */
function cfg(table) {
  const c = TABLES[table];
  if (!c) throw new Error(`未知表 · unknown table: ${table}`);
  return c;
}

/**
 * 主键值归一化（数字主键转数字，文本主键转字符串）
 * @param {object} c 表配置
 * @param {*} id 原始主键值
 * @returns {number|string} 归一化后的主键
 */
function toPk(c, id) {
  if (id === undefined || id === null || id === '') {
    throw new Error('缺少主键 · missing primary key');
  }
  if (c.primaryKey !== 'key') {
    const n = Number(id);
    if (Number.isInteger(n)) return n;
  }
  return String(id);
}

/**
 * 单值归一化：JSON 字段校验并压缩；整数/布尔字段转数字；空串转 NULL
 * @param {string} field 字段名
 * @param {*} value 原始值
 * @param {object} c 表配置
 * @returns {*} 可写入的值
 */
function normalize(field, value, c) {
  if (c.jsonFields.includes(field)) {
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    const s = String(value).trim();
    if (!s) return null;
    try {
      return JSON.stringify(JSON.parse(s));
    } catch {
      throw new Error(`字段 ${field} 不是合法 JSON · invalid JSON in "${field}"`);
    }
  }
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const s = typeof value === 'string' ? value.trim() : value;
  if (s === '') return null;
  if (INT_FIELDS.has(field)) {
    const n = Number(s);
    if (!Number.isInteger(n)) throw new Error(`字段 ${field} 需要整数 · integer required for "${field}"`);
    return n;
  }
  return String(s);
}

/**
 * 由入参构造列/值列表（含必填校验）
 * @param {object} c 表配置
 * @param {object} input 入参
 * @param {{forUpdate:boolean}} opts 是否为更新（更新时未提供的字段保持不变）
 * @returns {{cols:string[], vals:*[]}} 列名与值
 */
function buildData(c, input, { forUpdate }) {
  const cols = [];
  const vals = [];
  for (const f of c.fields) {
    // 主键：更新时不可改；自增表新增时不写主键
    if (f === c.primaryKey && (forUpdate || c.autoIncrement)) continue;

    const raw = input[f];
    if (raw === undefined) {
      if (!forUpdate && c.required.includes(f)) {
        throw new Error(`缺少必填字段 · missing required field: ${f}`);
      }
      continue; // 新增交给 DB 默认值；更新保持原值不变
    }
    if (c.required.includes(f)) {
      const empty = raw === null || (typeof raw === 'string' && raw.trim() === '');
      if (empty) throw new Error(`字段不可为空 · field cannot be empty: ${f}`);
    }
    cols.push(f);
    vals.push(normalize(f, raw, c));
  }
  return { cols, vals };
}

/**
 * 执行写操作并把 SQLite 约束错误转成可读中文提示
 * Run a write statement, mapping SQLite constraint errors to readable messages
 * @param {string} sql 参数化 SQL
 * @param {Array} params 参数
 * @returns {{changes:number|bigint, lastInsertRowid:number|bigint}} 执行结果
 */
async function runWrite(sql, params) {
  try {
    return await dbRun(sql, params);
  } catch (e) {
    const m = e.message || '';
    const col = m.includes(':') ? m.split(':').pop().trim() : '';
    if (/FOREIGN KEY constraint failed/i.test(m)) {
      throw new Error('关联记录不存在或已被删除（外键约束失败）· foreign key constraint failed: related record missing');
    }
    if (/UNIQUE constraint failed/i.test(m)) {
      throw new Error(`唯一约束冲突 · unique constraint violated${col ? `: ${col}` : ''}`);
    }
    if (/NOT NULL constraint failed/i.test(m)) {
      throw new Error(`必填字段不可为空 · NOT NULL constraint failed${col ? `: ${col}` : ''}`);
    }
    if (/CHECK constraint failed/i.test(m)) {
      throw new Error('CHECK 约束失败（如 site_settings 仅允许 id = 1）· check constraint failed');
    }
    throw e;
  }
}

/** 列出全部表配置（供界面/CLI 使用）· list all table configs */
export function listTables() {
  return Object.entries(TABLES).map(([name, c]) => ({
    name,
    label: c.label,
    primaryKey: c.primaryKey,
    autoIncrement: !!c.autoIncrement,
    singleRow: !!c.singleRow,
    fields: c.fields,
    fieldLabels: c.fieldLabels,
    required: c.required,
    jsonFields: c.jsonFields,
    intFields: [...INT_FIELDS],
    emojiFields: c.emojiFields || [],
  }));
}

/**
 * 查询列表 · list rows
 * @param {string} table 表名
 * @param {{limit?:*, offset?:*, q?:string}} [opts] 分页 / 全字段搜索
 * @returns {{total:number, limit:number, offset:number, rows:object[]}}
 */
export async function listRows(table, { limit, offset, q } = {}) {
  const c = cfg(table);
  const lim = Math.max(1, Math.min(1000, Number(limit) || 200));
  const off = Math.max(0, Number(offset) || 0);

  let where = '';
  const params = [];
  if (typeof q === 'string' && q.trim() !== '') {
    // 对全部非主键文本类列做 LIKE；JSON 字段整体为文本，可被命中
    const cols = c.fields.filter((f) => f !== c.primaryKey && !INT_FIELDS.has(f));
    if (cols.length) {
      const pattern = '%' + q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
      where = ' WHERE ' + cols.map((f) => `${f} LIKE ?`).join(' OR ');
      params.push(...Array(cols.length).fill(pattern));
    }
  }

  const rows = await dbAll(
    `SELECT * FROM ${table}${where} ORDER BY ${c.order} LIMIT ? OFFSET ?`,
    [...params, lim, off],
  );
  const totalRow = await dbGet(`SELECT COUNT(*) AS n FROM ${table}${where}`, params);
  return { total: Number(totalRow.n), limit: lim, offset: off, rows };
}

/**
 * 查询单行 · get one row
 * @param {string} table 表名
 * @param {number|string} id 主键
 * @returns {object|null} 记录（不存在返回 null）
 */
export async function getRow(table, id) {
  const c = cfg(table);
  const row = await dbGet(
    `SELECT * FROM ${table} WHERE ${c.primaryKey} = ?`,
    [toPk(c, id)],
  );
  return row ?? null;
}

/**
 * 新增 · create
 * @param {string} table 表名
 * @param {object} input 字段值
 * @returns {object} 新增后的完整记录
 */
export async function createRow(table, input = {}) {
  const c = cfg(table);
  await initSchema();

  if (c.singleRow) {
    if (await getRow(table, 1)) {
      throw new Error('单行表已有记录（id=1），请使用「编辑」· single-row table already has a record, use update');
    }
    input = { ...input, id: 1 };
  }

  const { cols, vals } = buildData(c, input, { forUpdate: false });
  if (cols.length === 0) throw new Error('没有可写入的字段 · no field to insert');

  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  const info = await runWrite(sql, vals);
  const pk = c.autoIncrement ? Number(info.lastInsertRowid) : input[c.primaryKey];
  return getRow(table, pk);
}

/**
 * 编辑 · update（只更新入参中出现的字段）
 * @param {string} table 表名
 * @param {number|string} id 主键
 * @param {object} input 待更新字段
 * @returns {object} 更新后的完整记录
 */
export async function updateRow(table, id, input = {}) {
  const c = cfg(table);
  const existing = await getRow(table, id);
  if (!existing) throw new Error(`记录不存在 · record not found: ${table}#${id}`);

  const { cols, vals } = buildData(c, input, { forUpdate: true });
  if (cols.length === 0) return existing;

  const sets = cols.map((f) => `${f} = ?`).join(', ');
  await runWrite(`UPDATE ${table} SET ${sets} WHERE ${c.primaryKey} = ?`, [...vals, toPk(c, id)]);
  return getRow(table, id);
}

/** 子表关系（删除主记录时会被 CASCADE 连带清理）· child tables cleaned up by CASCADE */
const CHILDREN = {
  concerts: [
    ['concert_likes', 'concert_id'],
    ['concert_tags', 'concert_id'],
    ['concert_images', 'concert_id'],
    ['concert_songlist', 'concert_id'],
  ],
};

/**
 * 统计会被级联删除的子表行数（删除前调用，便于提示用户影响面）
 * Count child rows that a delete would cascade into (call before deleting)
 * @param {string} table 主表名
 * @param {number|string} id 主键
 * @returns {Record<string, number>} 各子表行数（无子表则返回空对象）
 */
export async function countChildren(table, id) {
  const kids = CHILDREN[table];
  if (!kids) return {};
  const c = cfg(table);
  const out = {};
  for (const [child, col] of kids) {
    const r = await dbGet(`SELECT COUNT(*) AS n FROM ${child} WHERE ${col} = ?`, [toPk(c, id)]);
    out[child] = Number(r.n);
  }
  return out;
}

/**
 * 删除 · delete（子表通过 ON DELETE CASCADE 级联清理）
 * @param {string} table 表名
 * @param {number|string} id 主键
 * @returns {{deleted:number, cascade:Record<string,number>, row:object}} 删除条数、级联影响与被删记录
 */
export async function deleteRow(table, id) {
  const c = cfg(table);
  const existing = await getRow(table, id);
  if (!existing) throw new Error(`记录不存在 · record not found: ${table}#${id}`);

  const cascade = await countChildren(table, id);

  const info = await runWrite(`DELETE FROM ${table} WHERE ${c.primaryKey} = ?`, [toPk(c, id)]);
  return { deleted: Number(info.changes), cascade, row: existing };
}

export { initSchema };
