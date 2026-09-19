# UI 测试用例（浏览器手动回归）

> 覆盖首页全部功能模块。前置条件：`npm run dev` 已启动，数据库已就绪（统计卡片显示 14 / 12 / 9）。

## 1. 首屏与数据加载

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-001 首屏无闪屏 | 刷新首页，观察统计卡片区 | SSR 预取生效，统计卡片直接显示真实数字，不出现「Loading...」停留 |
| UI-002 统计卡片数值 | 查看页头统计区 | 与 `/api/data` 的 `stats` 一致：演唱会 14 / 歌手 12 / 城市 9 |
| UI-003 页面标题 | 查看浏览器标签页 | 标题与描述随语言显示对应文案（zh / en / zh-Hant 三套；zh 默认） |

## 2. 时间轴

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-004 时间轴渲染 | 滚动到时间轴区 | 每场演唱会按日期倒序排列，含海报、主题、城市信息 |
| UI-005 时间轴渐显 | 刷新页面观察 | 卡片逐个淡入（gsap 渐显），数据就绪后自动触发 |

## 3. 统计与角色列表

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-006 角色列表 | 查看宣言/演唱会数/城市数列表 | 桌面端默认布局正常；移动端（≤768px）列表项居左对齐 |

## 4. 城市列表模态框

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-007 打开城市模态框 | 点击「城市」入口 | 模态框弹出（`.show`），标题随语言更新，列出 9 座城市及各自场次数 |
| UI-008 城市多语言 | 切换语言后重开模态框 | 城市名与标题文案跟随语言切换 |
| UI-009 关闭模态框 | 点击关闭/遮罩/按 Esc | 模态框关闭，body 滚动恢复 |

## 5. 许愿墙

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-010 许愿墙渲染 | 滚动到许愿墙区 | 卡片白底圆角、顶部三色渐变条、网格布局，数量与数据库一致（21 条） |
| UI-011 点赞 | 点击某卡片点赞区 | liked 状态切换、计数 ±1 |
| UI-012 许愿时间 | 查看卡片时间戳 | 按相对时间显示（刚刚/N 分钟前…），语言切换后文案跟随 |

## 6. 票根模态框

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-013 打开票根 | 点击某场演唱会「票根」入口 | 模态框展示日期、场馆、座位、票价等多语言信息 |
| UI-014 票根标题 | 切换语言后重开 | 票根标题随语言更新 |

## 7. 歌单模态框

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-015 打开歌单 | 点击某场演唱会「歌单」入口 | 模态框含标题、副标题与歌单列表（与原版一致） |
| UI-016 搜索过滤 | 在搜索框输入关键词 | 歌单按关键词实时过滤 |
| UI-017 歌单链接 | 点击歌单项链接 | 链接在新窗口打开有效页面 |

## 8. 3D 专辑轮播

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-018 专辑轮播显示 | 查看专辑展示区 | 正面大卡 + 周围小卡环绕，入场动画仅播放一次（不卡 opacity:0） |
| UI-019 切换专辑 | 点击左右或键盘方向键 | 选中专辑切换，卡片 transform/CSS 过渡平滑 |
| UI-020 多语言切换后仍显示 | 切换语言 | 轮播不消失、不重复播放入场动画，文案随语言更新 |

## 9. 图片画廊

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-021 打开画廊 | 点击演唱会现场照片 | 画廊模态框打开并显示当前图 |
| UI-022 键盘导航 | 按 ← / → / Esc | 前后切换图片、Esc 关闭；缩略图加载失败自动降级原图 |

## 10. 视频模态框

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-023 打开视频 | 点击某场演唱会视频入口 | 模态框内播放 B 站视频（链接按原版拼接） |

## 11. 多语言切换

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-024 全站切换 | 依次切换到 en / zh-Hant | 页脚、模态框标题、票根标题、角色列表、许愿墙、专辑文案等全部随语言切换；URL 前缀随语言变化（`/en`、`/zh-Hant`，zh 无前缀）；无需重新请求（零请求） |
| UI-025 音乐源切换 | 切换语言 | 背景音乐源随语言切换 |
| UI-025b 直达链接 | 直接访问 `/en`、`/zh-Hant` | 首屏即以目标语言 SSR 渲染（文案与 `<html lang>` 一致），无需手动切换 |

## 12. 背景音乐

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-026 初始加载 | 打开页面 | 背景音乐自动初始化（浏览器允许情况下） |
| UI-027 播放/暂停 | 点击音乐按钮 | 图标在 `fa-pause` / `fa-music` 间切换，音量波动条随播放状态动效 |

## 13. 其他交互

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-028 返回顶部 | 滚动页面后点击返回顶部按钮 | 按钮仅在滚动后可见（可见性绑定），点击平滑回到顶部 |
| UI-029 友情链接 | 查看友链区 | 友链列表渲染正常，链接安全有效（`isValidUrl` 白名单） |
| UI-030 错误 Toast | 断开 API 后触发操作（或注入错误） | 页面底部弹出红色 Toast，`CONFIG.TOAST_DURATION` 后自动消失；错误日志写入 localStorage `errorLogs`（最多 50 条） |
| UI-031 模态框滚动锁定 | 依次打开各模态框 | 模态框打开时 body 滚动锁定，关闭后恢复 |

## 14. API 接口

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-032 聚合数据 | `GET /api/data` | 返回 `{ concerts, cities, wishes, stats }`，全部双语结构 |
| UI-033 单场详情 | `GET /api/concerts/:id`（如 1） | 返回双语详情（tags/images/songlist），字段为 `{zh,en}` |
| UI-034 404 | `GET /api/concerts/99999` | 返回 404 + 错误信息 |
| UI-035 参数校验 | `GET /api/concerts/abc` | 返回 400 + 错误信息 |

## 15. 多语言 SEO / PWA

> 可自动化：`node verify-seo.mjs`（根目录脚本，自动依次探测 `:3000`、`:3001`，逐语言抓取 SSR head 并打印 lang / title / og:locale / hreflang）。

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-036 hreflang 完整性 | 查看 `/`、`/en`、`/zh-Hant` 的 `<head>` | 每个页面均输出 3 语言 hreflang（`zh-CN` / `en` / `zh-Hant`）+ `x-default`，且默认语言 `zh-CN` 的 href 为 `https://ilive.lyc.la/`（无 `/zh` 前缀） |
| UI-037 html lang / og:locale | 查看各语言页面 head | `<html lang>` 依次为 `zh-CN` / `en` / `zh-Hant`；`og:locale` 为 `zh_CN` / `en` / `zh_Hant`，`og:locale:alternate` 列出其余 2 种语言 |
| UI-038 无重复 meta | 查看 head 源码 | title / description / keywords / og:title / og:description / twitter:title / twitter:description 各仅一份（由页面级 `useSeoMeta` 输出），`nuxt.config.ts` 不再硬编码中文文案 |
| UI-039 PWA manifest | `GET /manifest.webmanifest` | `name` = `Layicr Concert Journey`、`short_name` = `Layicr`（与语言无关的品牌名） |
| UI-040 描述随语言 | 对比 `/` 与 `/en` 的 `description` | 中文页为中文文案、英文页为英文文案；描述中的艺人串使用该语言的分隔符（中/繁用「、」，英用「, 」） |
| UI-041 canonical 语言前缀 | 查看 `/`、`/en`、`/zh-Hant` 的 `<link rel="canonical">` | 默认语言为 `https://ilive.lyc.la/`，其余为 `https://ilive.lyc.la/<code>`；各语言 canonical 互不相同（`nuxt.config.ts` 不再硬编码单条 canonical） |
| UI-042 SEO 文案来自 DB | 修改 `site_seo_i18n` 中 `site_title` 某语言的值后刷新对应语言页 | 页面 `<title>` / `description` / `keywords` 显示 DB 中的值（即 `/api/data` 的 `seo.i18n`），3 语言各自独立 |
| UI-043 DB 缺失回退 | 清空 `site_settings` / `site_seo_i18n`（或断开 DB）后访问各语言页 | 页面仍输出非空 title / description / keywords（回退到代码默认值与 i18n message），SSR 不报错、`/api/data` 有值则可正常返回 |
| UI-044 无重复 meta（DB 接入后） | 查看 head 源码 | canonical / hreflang / og:image / description / keywords / twitter:site / author / robots 各仅一份，不因 DB 与代码回退并存而重复输出 |

## 16. 演唱会点赞与热度标记

> 可自动化：`GET /api/data` 的 `concerts[].likes/liked`、`POST /api/like`（body `{ id }`）。

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-045 点赞 | 点击任意演唱会卡片按钮区（「查看歌单」左侧）的爱心 | 爱心由空心变实心红色，下方计数 +1；`POST /api/like` 返回 `{ id, likes: n+1, liked: true }` |
| UI-046 取消点赞 | 再次点击同一爱心 | 爱心恢复空心，计数 -1，回到点击前的数值（可反复切换） |
| UI-047 点赞持久化与去重 | 点赞后刷新页面 | 该场 `liked=true` 且 `likes` 与操作后一致；同一 IP 重复点击不叠加（`concert_likes` 按 `(concert_id, ip)` 唯一） |
| UI-048 热度标记 | 让点赞数排前三的演唱会 | 歌手名（`.concert-artist`）后紧跟 `fa-fire` 火图标（同一行、脉冲发光 + 提示「热门演唱会」）；点赞数为 0 的场次不出现；并列第三名同时显示；不足三场时有几场显示几场 |

## 17. 留言板

> 可自动化：`test/e2e/guestbook.spec.ts`（`GET /api/guestbook`、`POST /api/guestbook`、`POST /api/guestbook/reply`）。

| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| UI-049 留言板渲染 | 滚动到留言板区 | 标题「✨ 留言板」为蓝紫→橙渐变文字且左对齐；主留言按时间倒序，展示昵称 / 时间 / 浏览器 / 系统 |
| UI-050 发布留言 | 填写昵称 / 邮箱 / 内容后点「发布留言」 | 提交成功后回到第 1 页，最新留言置顶（服务端自动通过 `is_approved=1`） |
| UI-051 邮箱校验（主表单） | 邮箱留空或格式非法后提交 | 表单下方显示站内错误提示（「请输入正确的邮箱地址」），不弹浏览器原生气泡（表单已 `novalidate`），不发请求 |
| UI-052 回复折叠 | 展开某条留言的回复区 | 回复 > 3 条时默认仅显示 3 条并在下方出现「更多」；≤ 3 条时全部显示且无「更多」；无回复时不渲染回复区 |
| UI-053 「更多」分页 | 连续点击「更多」 | 每次追加 10 条（3 → 13 → 23 …）；未显示完时按钮常驻，全部展开后自动消失 |
| UI-054 回复表单 | 点击「回复」 | 展开表单含昵称 / 邮箱 / 内容三个输入；邮箱格式非法时显示站内提示并前端拦截 |
| UI-055 回复表情 | 点击回复表单的 😊 按钮 | 表情面板展开，点击表情插入到回复内容；再次点击按钮收起（与主留言表情面板互不串扰） |
| UI-056 UGC 文本安全 | 留言 / 回复内容含 `<script>` / `onerror` 载荷 | 以纯文本字面渲染，不生成脚本 / 图片元素、不执行 |

---

## 最近回归记录

- 2026-08-22：SSR 修复后全量回归 —— 首屏 200 无 DOMParser 报错、`/api/data` 与详情接口双语正常、404/400 正常。（[ ] 其余用例待逐项勾选）
- 2026-08-22（二次）：构建产物 server 自动化验收（HTTP 抓取 + API 比对）——
  - [x] UI-001 首屏 SSR：HTTP 200，HTML 直接含 14/12/9 真实统计数字，无 `Loading` 停留
  - [x] UI-002 统计卡片：与 `/api/data` 的 `stats` 一致（14 演唱会 / 12 歌手 / 9 城市）
  - [x] UI-003 页面标题：`layicr - 演唱会足迹`（中文默认）
  - [x] UI-024 双语：首屏 HTML 含英文文案 `Mayday`/`Concert`，`highlight-fill` 故事区已 SSR 渲染（点击切换零请求由 composable 保证）
  - [x] UI-032 聚合数据：`GET /api/data` 返回 `{concerts(14),cities(9),wishes(21),stats}`，结构含双语 `artist:{zh,en}`
  - [x] UI-033 单场详情：`GET /api/concerts/1` 返回 18 字段双语详情（tags/images/songlist/videoUrl 等）
  - [x] UI-034 404：`GET /api/concerts/99999` → 404 + 错误信息
  - [x] UI-035 400：`GET /api/concerts/abc` → 400 + 参数校验错误
  - 单元测试（vitest run）：6 文件 / 47 用例全部通过（safeHtml 11 / formatWishDate 4 / formatWishTime 5 / config 4 / mappers 12 / localize 11）
  - 注：交互类用例（UI-004~031 模态框/轮播/画廊/音乐等）仍需浏览器手动逐项勾选。
- 2026-09-12：多语言 SEO 修复验收（i18n-handoff P1/P2，SSR head 自动化抓取）——
  - [x] UI-003 页面标题/描述：zh / en / zh-Hant / ja / ko 五语言标题与描述均按语言输出
  - [x] UI-036 hreflang：各语言页面均输出 `zh-CN` / `en` / `zh-Hant` / `ja` / `ko` + `x-default` 共 6 条；默认语言 href 为 `https://ilive.lyc.la/`
  - [x] UI-037 html lang / og:locale：`zh-CN` / `en` / `zh-Hant` / `ja` / `ko` 与 `zh_CN` / `en` / `zh_Hant` / `ja` / `ko` 逐一对应，`og:locale:alternate` 为其余 4 种语言
  - [x] UI-038 无重复 meta：`nuxt.config.ts` 中文 title/keywords/description/og/twitter 硬编码已清理，仅保留与语言无关的静态 meta
  - [x] UI-039 PWA manifest：`name` = `Layicr Concert Journey`、`short_name` = `Layicr`
  - [ ] UI-040 描述分隔符：待浏览器逐语言比对（单测已覆盖 `ARTIST_DELIMITER` / `DESCRIPTION_TEMPLATES`）
  - 单元测试（vitest run）：7 文件 / 89 用例全部通过（新增 `i18n.test.ts` 23 例）
- 2026-09-12：SEO 参数数据库化（SEO_DB_MIGRATION.md 实施，SSR head 四场景自动化抓取）——
  - [x] UI-041 canonical 语言前缀：`/` = `https://ilive.lyc.la/`；`/en` `/zh-Hant` `/ja` `/ko` 各带语言前缀，五语言互不相同
  - [x] UI-042 SEO 来自 DB：自定义库场景下五语言 title / description / keywords 均取 DB 值（`/api/data` 的 `seo.i18n`）
  - [x] UI-043 DB 缺失回退：空值库、DB 不可用两种场景下页面仍输出完整非空 SEO（回退代码默认值与 i18n message），SSR 仍 200
  - [x] UI-044 无重复 meta：canonical 1 / hreflang 6 / og:image 1 / description 1 / keywords 1 / twitter:site 1 / author 1 / robots 1
  - [x] UI-036 / UI-037：hreflang 仍为 5 语言 + `x-default`，`<html lang>` 与 `og:locale` 正确
  - [x] UI-032 扩展：`GET /api/data` 响应新增 `seo` 字段（随同一次请求返回，未新增 API 端点）
  - 单元测试（vitest run）：8 文件 / 106 用例全部通过（新增 `seo-settings.test.ts` 15 例）
- 2026-09-13：演唱会点赞与热度标记 ——
  - [x] UI-045 ~ UI-047 点赞 / 取消 / 持久化：`POST /api/like` 切换正确（`{likes:1,liked:true}` → `{likes:0,liked:false}` → `{likes:1,liked:true}`），`/api/data` 与 `/api/concerts/:id` 按请求 IP 合并 `liked`；`concert_likes` 按 `(concert_id, ip)` 唯一去重
  - [x] 接口边界：非法 id → 400；不存在的演唱会 → 404
  - [x] UI-048 热度标记：点赞数 >0 的前三档（并列同显）在歌手名后显示 `fa-fire`；0 赞场次不显示
  - [x] 库迁移：`npm run db:migrate-add-concert-likes` 已对本地库执行（新建 `concert_likes`、删除 `concerts.likes`），`seed-test.mjs` 按新 schema 建库通过
  - 单元测试（vitest run）：10 文件 / 143 用例（新增 `concertLikes.test.ts` 13 例 + `pickHotConcertIds` 5 例；既有 15 例失败为 `zh` vs `zh-CN` 键名与 `app.vue` 源码回归，与本次无关）
- 2026-09-19：留言板功能增强 ——
  - [x] UI-049 留言板渲染：标题「✨ 留言板」渐变文字 + 左对齐；主留言按时间倒序（e2e `guestbook.spec.ts`）
  - [x] UI-052 / UI-053 回复折叠与「更多」：>3 条默认 3 条 + 「更多」，每次 +10（3 → 13 → 15），展开完按钮消失（e2e 覆盖）
  - [x] UI-054 / UI-055 回复表单邮箱与表情：展开回复表单含邮箱输入；表情按钮开合面板并插入内容（e2e 覆盖）
  - [x] UI-051 邮箱校验：主表单 `novalidate` + 前端正则校验，非法邮箱显示站内提示、不发请求（e2e 覆盖）
  - [x] UI-056 UGC 文本安全：留言 / 回复中的脚本与事件载荷以纯文本渲染不执行（e2e 覆盖）
  - [x] fixture 扩展：`seed-e2e-db.mjs` 新增留言板种子（4 条主留言 / 18 条回复，含 15 回复与 XSS 载荷）
  - 单元测试（vitest run）：20 文件 / 303 用例全部通过（`guestbook.test.ts` 新增可选邮箱与 UGC 原样存储 3 例；`parse.test.ts` 按 `parseTags` 新契约更新「字符串归一化」用例）
