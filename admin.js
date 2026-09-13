const BOOL_FIELDS = new Set(['enabled', 'liked']);

// 站点支持的语言（新增记录时作为默认语言集，编辑时与 JSON 已有键合并）
// supported locales: default set for new rows; merged with keys already present in the JSON when editing
const LOCALES = ['zh-CN', 'en', 'zh-Hant'];

// 这些 i18n 字段按语言存的是「数组」（每行一个条目），其余为字符串
// these i18n columns store a per-locale *array* (one item per line); the rest store strings
const ARRAY_I18N_FIELDS = new Set(['i18n']);

// 内置 emoji 候选集（覆盖城市/地标/自然/活动/通用场景，无需外部依赖）
// built-in emoji palette for the icon picker (no external dependency)
const EMOJI_SET = [
  '🏛️','🏰','🗼','🗽','🏙️','🌉','🌃','🏞️','⛰️','🌋','🗻','🏔️','🌄','🌅','🏝️','🏖️',
  '🌊','🌁','🌆','🕌','🛕','⛪','🕍','🏯','🏟️','🎡','🎢','🎠','⛲','🗿','🌍','🌎',
  '🌏','🚉','✈️','🚄','🚢','⛵','🚌','🚗','🌲','🌳','🌴','🌵','🌸','🌺','🌻','🍁',
  '🍂','🍃','🐱','🐶','🦊','🐼','🦄','🍔','🍕','🍜','🍣','🍎','🍷','☕','🎵','🎨',
  '⚽','🏀','🎯','💡','🔥','⭐','🌟','💎','🎉','📍','🏠','🛍️','📚','💻','📷','🌈',
];

const state = { tables: [], cfg: null, rows: [], total: 0, editing: null, page: 1, limit: 20, q: '' };
const $ = (id) => document.getElementById(id);

// 单表模式：页面通过 window.ADMIN_TABLE 指定表名时，只展示该表（实现「一张表一个 HTML 页面」）
// single-table mode: when a page sets window.ADMIN_TABLE, only that table is shown
const SINGLE = window.ADMIN_TABLE || null;

async function api(path, options = {}) {
  const res = await fetch('/api' + path, { headers: { 'content-type': 'application/json' }, ...options });
  let data = {};
  try { data = await res.json(); } catch (e) { /* 忽略空响应 */ }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function toast(msg, ok = true) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (ok ? 'ok' : 'err');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function pretty(v) {
  if (v === null || v === undefined || v === '') return '';
  try { return JSON.stringify(JSON.parse(v), null, 2); } catch (e) { return String(v); }
}

function cellText(field, v) {
  if (v === null || v === undefined) return '';
  if (state.cfg.jsonFields.includes(field)) return ''; // 多语言字段交由 renderI18nCell 渲染
  return String(v);
}

/**
 * 多语言字段：读取 JSON 后在页面按「一种语言一行」展示
 * i18n cell: parse the stored JSON and render each locale on its own line.
 * 文本值直接显示；数组值（如 concert_tags）用「 / 」连接。
 */
function renderI18nCell(field, v) {
  if (!state.cfg.jsonFields.includes(field)) return null;
  let o;
  try { o = typeof v === 'string' ? JSON.parse(v) : v; } catch { o = null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;

  const wrap = document.createElement('div');
  wrap.className = 'i18n';
  for (const [lang, val] of Object.entries(o)) {
    const line = document.createElement('div');
    line.className = 'i18n-line';
    const badge = document.createElement('span');
    badge.className = 'lang';
    badge.textContent = lang;
    const txt = document.createElement('span');
    txt.className = 'val';
    txt.textContent = Array.isArray(val)
      ? val.join(' / ')
      : (val === null || val === undefined ? '' : String(val));
    line.append(badge, txt);
    wrap.appendChild(line);
  }
  return wrap;
}

/** 把存储的 i18n 值（JSON 字符串或对象）解析为普通对象 · parse a stored i18n value into a plain object */
function parseI18n(v) {
  if (v === null || v === undefined || v === '') return {};
  if (typeof v === 'object') return v;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * 多语言字段编辑态：按语言拆成多个文本框（有几个语言就显示几个），
 * 保存时由 saveForm 拼回 JSON 字符串。
 * i18n editor: one textbox per locale; saveForm re-assembles them into JSON.
 * @param {string} field 字段名 · column name
 * @param {*} val 现有值（JSON 字符串或对象）· current value
 * @returns {HTMLElement} 容器 · wrapper element
 */
function renderI18nInputs(field, val) {
  const o = parseI18n(val);
  // 语言集合：JSON 已有键 ∪ 默认语言集（保证新增/补录语言也能输入）
  // locale set = keys already in JSON ∪ default LOCALES
  const langs = [...new Set([...Object.keys(o), ...LOCALES])];
  const isArrayField = ARRAY_I18N_FIELDS.has(field);

  const wrap = document.createElement('div');
  wrap.className = 'i18n-edit';
  for (const lang of langs) {
    const isArr = Array.isArray(o[lang]) || (o[lang] === undefined && isArrayField);
    const grp = document.createElement('div');
    grp.className = 'i18n-grp';

    const lab = document.createElement('label');
    lab.className = 'i18n-lang';
    lab.textContent = lang;

    const el = isArr ? document.createElement('textarea') : document.createElement('input');
    el.dataset.i18n = field;
    el.dataset.lang = lang;
    el.dataset.array = isArr ? '1' : '';
    if (isArr) {
      el.rows = 3;
      el.value = Array.isArray(o[lang]) ? o[lang].join('\n') : '';
    } else {
      el.type = 'text';
      el.value = o[lang] === null || o[lang] === undefined ? '' : String(o[lang]);
    }
    grp.append(lab, el);
    wrap.appendChild(grp);
  }
  return wrap;
}

/**
 * emoji 图标选择器：点击「选择图标」弹出内置 emoji 网格，选中即写入隐藏输入框。
 * 输入框带 data-field，saveForm 会像普通字段一样收集其值（空串会被服务端转成 NULL）。
 * emoji icon picker: a button opens a built-in grid; the chosen emoji is stored in a
 * data-field input so saveForm collects it like any other field (empty → NULL server-side).
 * @param {string} field 字段名 · column name
 * @param {*} val 现有值（emoji 字符串）· current emoji value
 * @returns {HTMLElement} 容器 · wrapper element
 */
function renderEmojiPicker(field, val) {
  const current = val === null || val === undefined ? '' : String(val);

  const wrap = document.createElement('div');
  wrap.className = 'emoji-picker';

  const preview = document.createElement('span');
  preview.className = 'emoji-preview';
  preview.textContent = current || '—';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'emoji-value';
  input.readOnly = true;
  input.placeholder = '未选择';
  input.dataset.field = field;
  input.value = current;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn emoji-btn';
  btn.textContent = '选择图标';

  const pop = document.createElement('div');
  pop.className = 'emoji-pop';
  pop.hidden = true;

  for (const e of EMOJI_SET) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'emoji-cell';
    cell.textContent = e;
    cell.onclick = (ev) => {
      ev.stopPropagation();
      input.value = e;
      preview.textContent = e;
      pop.hidden = true;
    };
    pop.appendChild(cell);
  }

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'emoji-cell emoji-clear';
  clear.textContent = '清除';
  clear.onclick = (ev) => {
    ev.stopPropagation();
    input.value = '';
    preview.textContent = '—';
    pop.hidden = true;
  };
  pop.appendChild(clear);

  btn.onclick = (ev) => {
    ev.stopPropagation();
    pop.hidden = !pop.hidden;
  };
  pop.addEventListener('click', (ev) => ev.stopPropagation());

  wrap.append(preview, input, btn, pop);
  return wrap;
}

function renderTabs() {
  if (SINGLE) return; // 单表模式不渲染侧栏标签
  const nav = $('tabs');
  nav.innerHTML = '';
  for (const t of state.tables) {
    const b = document.createElement('button');
    b.innerHTML = t.label + '<small>' + t.name + '</small>';
    if (state.cfg && state.cfg.name === t.name) b.classList.add('active');
    b.onclick = () => selectTable(t.name);
    nav.appendChild(b);
  }
}

async function loadTables() {
  const data = await api('/tables');
  state.tables = data.tables;
  $('dbpath').textContent = data.db;
  renderTabs();

  if (SINGLE) {
    if (!data.tables.some((t) => t.name === SINGLE)) {
      $('title').textContent = '未知表';
      toast('未找到表：' + SINGLE, false);
      return;
    }
    // 单表模式：侧栏改为「返回总览」链接，跳过标签切换
    const nav = $('tabs');
    nav.innerHTML = '';
    const back = document.createElement('a');
    back.href = 'admin.html';
    back.className = 'btn';
    back.textContent = '← 返回总览';
    back.style.cssText = 'margin:10px;display:block;text-align:center;text-decoration:none;';
    nav.appendChild(back);
    await selectTable(SINGLE);
    return;
  }

  if (state.tables.length) await selectTable(state.tables[0].name);
}

async function selectTable(name) {
  state.cfg = state.tables.find((t) => t.name === name);
  state.page = 1;
  state.q = '';
  $('search-input').value = '';
  $('btn-clear-search').hidden = true;
  renderTabs();
  await loadRows();
}

async function loadRows() {
  const c = state.cfg;
  if (!c) return;
  const offset = (state.page - 1) * state.limit;
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(offset) });
  if (state.q) params.set('q', state.q);
  const data = await api('/' + c.name + '?' + params.toString());
  state.rows = data.rows;
  state.total = data.total;
  $('title').textContent = c.label + ' · ' + c.name;
  const start = data.total === 0 ? 0 : data.offset + 1;
  const end = Math.min(data.offset + data.rows.length, data.total);
  const searchHint = state.q ? ' · 搜索“' + state.q + '”' : '';
  $('sub').textContent = `共 ${data.total} 条 · 显示 ${start}-${end}${searchHint} · 主键 ${c.primaryKey}`;
  $('btn-add').disabled = !!(c.singleRow && data.total > 0);
  renderGrid();
  renderPagination();
}

function renderGrid() {
  const c = state.cfg;
  const head = $('grid').querySelector('thead');
  const body = $('grid').querySelector('tbody');
  head.innerHTML = '';
  body.innerHTML = '';

  const tr = document.createElement('tr');
  for (const f of c.fields) {
    const th = document.createElement('th');
    th.textContent = f;
    tr.appendChild(th);
  }
  const thOp = document.createElement('th');
  thOp.textContent = '操作';
  tr.appendChild(thOp);
  head.appendChild(tr);

  for (const row of state.rows) {
    const r = document.createElement('tr');
    for (const f of c.fields) {
      const td = document.createElement('td');
      if (f === c.primaryKey) td.className = 'pk';
      const i18n = renderI18nCell(f, row[f]);
      if (i18n) {
        td.appendChild(i18n);
      } else {
        const span = document.createElement('div');
        span.className = 'clip';
        span.textContent = cellText(f, row[f]);
        td.appendChild(span);
      }
      r.appendChild(td);
    }
    const tdOp = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const bEdit = document.createElement('button');
    bEdit.className = 'btn';
    bEdit.textContent = '编辑';
    bEdit.onclick = () => openForm('edit', row);

    const bDel = document.createElement('button');
    bDel.className = 'btn btn-danger';
    bDel.textContent = '删除';
    bDel.onclick = () => removeRow(row);

    wrap.appendChild(bEdit);
    wrap.appendChild(bDel);
    tdOp.appendChild(wrap);
    r.appendChild(tdOp);
    body.appendChild(r);
  }

  const isEmpty = state.rows.length === 0;
  $('grid').hidden = isEmpty;
  $('empty').hidden = !isEmpty;
}

function renderPagination() {
  const total = state.total;
  const pages = Math.ceil(total / state.limit) || 1;
  const pager = $('pager');
  if (total === 0 && !state.q) {
    pager.hidden = true;
    return;
  }
  pager.hidden = false;
  $('page-info').textContent = `第 ${state.page} / ${pages} 页 · 每页 ${state.limit} 条`;
  $('btn-prev').disabled = state.page <= 1;
  $('btn-next').disabled = state.page >= pages;
}

function openForm(mode, row) {
  const c = state.cfg;
  state.editing = { mode, row };
  $('modal-title').textContent = (mode === 'create' ? '新增 · ' : '编辑 · ') + c.label;

  const form = $('form');
  form.innerHTML = '';
  for (const f of c.fields) {
    if (mode === 'create' && f === c.primaryKey && c.autoIncrement) continue;

    const val = row ? row[f] : null;
    const label = document.createElement('label');
    label.className = 'field';

    /* 字段标题：中文名为主，原始列名作为小字提示保留
       Field title: the Chinese name is primary; the raw column name stays as a subtle hint */
    const name = document.createElement('span');
    name.className = 'fname';

    const title = (c.fieldLabels && c.fieldLabels[f]) || f;
    const labelText = document.createElement('span');
    labelText.className = 'ftitle';
    labelText.textContent = title;
    name.appendChild(labelText);

    if (c.jsonFields.includes(f)) {
      const tag = document.createElement('em');
      tag.className = 'ftag';
      tag.textContent = '多语言';
      tag.title = '各语言以 JSON 存储 · stored as per-locale JSON';
      name.appendChild(tag);
    }

    if (c.required.includes(f)) {
      const req = document.createElement('b');
      req.className = 'req';
      req.textContent = '*';
      req.title = '必填 · required';
      name.appendChild(req);
    }

    if (title !== f) {
      const col = document.createElement('code');
      col.className = 'fcol';
      col.textContent = f;
      name.appendChild(col);
    }

    label.appendChild(name);

    let input;
    if (c.jsonFields.includes(f)) {
      // 多语言字段：按语言拆成多个文本框，保存时由 saveForm 拼回 JSON
      input = renderI18nInputs(f, val);
    } else if (BOOL_FIELDS.has(f)) {
      input = document.createElement('select');
      input.innerHTML = '<option value="1">是 · 1</option><option value="0">否 · 0</option>';
      input.value = val === null || val === undefined ? '0' : String(val);
      input.dataset.field = f;
    } else if (c.emojiFields && c.emojiFields.includes(f)) {
      // emoji 图标选择器：点击弹出网格，选中写入隐藏输入框
      input = renderEmojiPicker(f, val);
    } else {
      input = document.createElement('input');
      input.type = c.intFields.includes(f) ? 'number' : 'text';
      input.value = val === null || val === undefined ? '' : String(val);
      input.dataset.field = f;
    }
    if (mode === 'edit' && f === c.primaryKey) input.readOnly = true;
    label.appendChild(input);
    form.appendChild(label);
  }
  $('modal').hidden = false;
}

function closeModal() {
  $('modal').hidden = true;
  state.editing = null;
}

async function saveForm() {
  const c = state.cfg;
  const { mode, row } = state.editing;
  const body = {};
  for (const el of $('form').querySelectorAll('[data-field]')) body[el.dataset.field] = el.value;

  // 多语言字段：把每个语言的文本框拼回 JSON 对象后整体发送（服务端再次 JSON.stringify 落库）
  // i18n fields: re-assemble per-locale textboxes into one JSON object for the server
  for (const f of c.fields) {
    if (!c.jsonFields.includes(f)) continue;
    const obj = {};
    for (const el of $('form').querySelectorAll(`[data-i18n="${f}"]`)) {
      const v = el.value;
      if (v === '' || v == null) continue; // 跳过空语言，保持 JSON 干净
      if (el.dataset.array === '1') {
        obj[el.dataset.lang] = v.split('\n').map((s) => s.trim()).filter((s) => s !== '');
      } else {
        obj[el.dataset.lang] = v;
      }
    }
    body[f] = obj;
  }

  try {
    if (mode === 'create') {
      await api('/' + c.name, { method: 'POST', body: JSON.stringify(body) });
      toast('新增成功');
    } else {
      const id = encodeURIComponent(row[c.primaryKey]);
      await api('/' + c.name + '/' + id, { method: 'PUT', body: JSON.stringify(body) });
      toast('保存成功');
    }
    closeModal();
    await loadRows();
  } catch (e) {
    toast(e.message, false);
  }
}

async function removeRow(row) {
  const c = state.cfg;
  const id = row[c.primaryKey];
  if (!confirm('确认删除 ' + c.label + ' #' + id + ' ？\n删除后不可恢复（子表数据会级联删除）。')) return;
  try {
    const r = await api('/' + c.name + '/' + encodeURIComponent(id), { method: 'DELETE' });
    const affected = Object.entries(r.cascade || {}).filter(([, n]) => n > 0);
    const extra = affected.length
      ? '（级联清理 ' + affected.map(([t, n]) => t + ' × ' + n).join('，') + '）'
      : '';
    toast('已删除 ' + r.deleted + ' 条' + extra);
    // 删除后若当前页已无数据且不是第一页，则回到上一页
    const pages = Math.ceil((state.total - r.deleted) / state.limit) || 1;
    if (state.page > pages) state.page = pages;
    await loadRows();
  } catch (e) {
    toast(e.message, false);
  }
}

$('btn-refresh').onclick = () => loadRows().catch((e) => toast(e.message, false));
$('btn-add').onclick = () => openForm('create', null);
$('btn-close').onclick = closeModal;
$('btn-cancel').onclick = closeModal;
$('btn-save').onclick = saveForm;
// 点击弹窗遮罩（框外）关闭；点在 .modal-box 内部则不关闭
// click on the backdrop (outside the box) closes; clicks inside .modal-box are ignored
$('modal').addEventListener('click', (e) => {
  if (!e.target.closest('.modal-box')) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// 点击空白处关闭已展开的 emoji 图标选择网格（选择器内部已 stopPropagation，不会误关）
// clicking elsewhere closes any open emoji popover (the picker stops propagation internally)
document.addEventListener('click', () => {
  document.querySelectorAll('.emoji-pop:not([hidden])').forEach((p) => { p.hidden = true; });
});

/* 搜索 · search */
function doSearch() {
  state.q = $('search-input').value.trim();
  state.page = 1;
  $('btn-clear-search').hidden = !state.q;
  loadRows().catch((e) => toast(e.message, false));
}
$('btn-search').onclick = doSearch;
$('btn-clear-search').onclick = () => {
  $('search-input').value = '';
  doSearch();
};
$('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

/* 分页 · pagination */
$('btn-prev').onclick = () => { if (state.page > 1) { state.page--; loadRows().catch((e) => toast(e.message, false)); } };
$('btn-next').onclick = () => { state.page++; loadRows().catch((e) => toast(e.message, false)); };

loadTables().catch((e) => { $('title').textContent = '加载失败'; toast(e.message, false); });
