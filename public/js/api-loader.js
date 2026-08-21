/**
 * API 数据加载器 · API Data Loader
 *
 * @module api-loader
 * @description 从 `/api/*` 接口拉取演唱会/城市/许愿数据，填充到前端数据对象。
 *              数据**完全来自数据库**，不做静态数据降级：API 失败或库为空时，
 *              前端数据保持空数组（页面如实显示空态/骨架）。
 *
 *              Fetches concert/city/wish data from `/api/*` into the frontend data objects.
 *              Data comes **entirely from the database** with no static-data fallback:
 *              on API failure or empty DB the frontend keeps empty arrays (shows empty state).
 *
 * 依赖顺序（由 legacy.client.ts 注入，须在 datas_zh.js / datas_en.js / utils.js 之后加载）：
 *              - concertDataZH / concertDataEN（datas_zh.js / datas_en.js 定义，数据初始为空）
 *              - wishesDataZH / wishesDataEN（datas_zh.js / datas_en.js 定义，数据初始为空）
 *              - processSonglist（utils.js 定义，用于歌单本地化）
 */

/**
 * 取双语对象的指定语言值· Pick a value from a {zh,en} pair
 * @param {Object|null|undefined} obj 双语对象 · {zh,en} pair
 * @param {string} lang 语言 · language
 * @param {string} [fallback=''] 缺省值 · fallback
 * @returns {string}
 */
function apiPick(obj, lang, fallback = '') {
  if (obj && obj[lang] != null) return obj[lang];
  return fallback;
}

/**
 * 将 API 返回的双语演唱会本地化为单语言结构· Localize an API concert to a single language
 * @param {Object} api 双语演唱会对象 · bilingual concert from API
 * @param {string} lang 语言 · language ('zh' | 'en')
 * @returns {Object} 前端期望的单语言演唱会对象（与 generateZHData 输出结构一致）
 */
function localizeConcert(api, lang) {
  // songlist 已是 {zh,en,link} 结构，直接用 utils.processSonglist 本地化
  const songlist = processSonglist(api.songlist || [], lang);

  return {
    id: api.id,
    artist: apiPick(api.artist, lang),
    concertName: apiPick(api.concertName, lang),
    theme: apiPick(api.theme, lang),
    location: apiPick(api.location, lang),
    seat: api.seat ? apiPick(api.seat, lang, null) : null,
    price: api.price ? apiPick(api.price, lang, null) : null,
    date: api.date,
    time: api.time,
    poster: api.poster,
    tags: (api.tags && api.tags[lang]) ? api.tags[lang] : [],
    description: apiPick(api.description, lang),
    images: (api.images || []).map(img => ({
      src: img.src,
      alt: apiPick(img.alt, lang)
    })),
    video: api.video ? apiPick(api.video, lang, null) : null,
    videoUrl: api.videoUrl ? apiPick(api.videoUrl, lang, null) : null,
    songlist
  };
}

/**
 * 从 /api/concerts 拉取并重建 concertDataZH / concertDataEN 的 concerts 与 cities
 * @returns {Promise<boolean>} 是否成功· success flag
 * @description 成功时覆盖全局数据对象的 concerts/cities；失败或库为空返回 false，
 *              前端保持空数组显示空态（不做静态数据降级）。
 *              由于 concertDataZH 是 const，这里只修改其属性（对象内容可变）。
 */
async function loadConcertsFromApi() {
  const res = await fetch('/api/concerts');
  if (!res.ok) return false;
  const payload = await res.json();
  const concerts = payload.concerts || [];
  if (!Array.isArray(concerts) || concerts.length === 0) return false;

  // 本地化两种语言，分别覆盖 zh/en 数据对象
  concertDataZH.concerts = concerts.map(c => localizeConcert(c, 'zh'));
  concertDataEN.concerts = concerts.map(c => localizeConcert(c, 'en'));

  return true;
}

/**
 * 从 /api/cities 拉取并重建 cities（含场次数）· Fetch cities from API
 * @returns {Promise<boolean>} 是否成功· success flag
 */
async function loadCitiesFromApi() {
  const res = await fetch('/api/cities');
  if (!res.ok) return false;
  const cities = await res.json();
  if (!Array.isArray(cities) || cities.length === 0) return false;

  // API 返回 { id, country:{zh,en}, name:{zh,en}, icon, concerts }
  // 前端期望 { name, concerts, icon }
  concertDataZH.cities = cities.map(c => ({
    name: apiPick(c.name, 'zh'),
    concerts: c.concerts || 0,
    icon: c.icon || ''
  }));
  concertDataEN.cities = cities.map(c => ({
    name: apiPick(c.name, 'en'),
    concerts: c.concerts || 0,
    icon: c.icon || ''
  }));

  return true;
}

/**
 * 从 /api/wishes 拉取并重建 wishesDataZH / wishesDataEN· Fetch wishes from API
 * @returns {Promise<boolean>} 是否成功· success flag
 * @description API 返回 { id, content:{zh,en}, time, likes, liked }；
 *              前端 wishesDataZH 是 const 数组，需原地替换（length=0 + push）。
 */
async function loadWishesFromApi() {
  const res = await fetch('/api/wishes');
  if (!res.ok) return false;
  const wishes = await res.json();
  // 空库（无许愿数据）时保持空数组，前端显示许愿墙空态
  // on empty DB keep empty array so the wish wall shows its empty state
  if (!Array.isArray(wishes) || wishes.length === 0) return false;

  const toFrontend = (w, lang) => ({
    content: apiPick(w.content, lang),
    time: w.time,
    likes: w.likes || 0,
    liked: !!w.liked
  });

  // 原地替换 const 数组内容（保留引用）
  wishesDataZH.length = 0;
  wishesDataZH.push(...wishes.map(w => toFrontend(w, 'zh')));
  wishesDataEN.length = 0;
  wishesDataEN.push(...wishes.map(w => toFrontend(w, 'en')));

  return true;
}

/**
 * 依次从 API 拉取全部数据并填充数据对象· Try to load all data from API
 * @returns {Promise<boolean>} 演唱会数据是否成功加载· whether concert data loaded
 * @description 任一步失败不抛错，返回 false（前端保持空数组显示空态），不做静态数据降级。
 *              该函数挂到 window 供 legacy.client.ts 调用。
 */
async function ensureApiData() {
  const results = await Promise.allSettled([
    loadConcertsFromApi(),
    loadCitiesFromApi(),
    loadWishesFromApi()
  ]);

  // 只要演唱会数据成功即认为数据可用；否则前端保持空态
  const ok = results[0].status === 'fulfilled' && results[0].value === true;
  if (ok) {
    console.log('[api-loader] 已从 API 加载数据 · data loaded from API');
  } else {
    console.warn('[api-loader] API 未返回演唱会数据，前端显示空态 · no concert data from API, showing empty state');
  }
  return ok;
}

// 挂到 window，供 legacy.client.ts 调用（经典脚本共享全局）
window.ensureApiData = ensureApiData;
window.localizeConcert = localizeConcert;
