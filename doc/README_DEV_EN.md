# Concert Footprints (ilive_neo) Development Documentation

> Nuxt4 + Turso(LibSQL) Migration Version · Recording the emotion and memories of every concert
>
> [中文文档](./README_DEV.md) | English Version

---

## 1. Project Overview

"Concert Footprints" is a personal concert recording site, migrated from a purely static site (`index.html` + vanilla JS + hand-written Service Worker). This repository (`ilive_neo`) upgrades the architecture while **preserving 100% of the original visual effects**:

- **Nuxt4** (SSR + Vue3 + TypeScript)
- **Turso / LibSQL** database (remote `libsql:` as primary, local `file:` for development fallback only)
- **@vite-pwa/nuxt** for Service Worker generation (replacing hand-written `sw.js`)

> **Nuxt 4 directory convention**: `srcDir` defaults to `app/`, so `app.vue`, `pages/`,
> `composables/`, `plugins/`, `utils/`, `types/` all live under `app/`; `server/`, `public/`,
> `test/`, `i18n/`, `nuxt.config.ts` stay at the project root (locale messages live in
> `i18n/locales/`, and `@nuxtjs/i18n`'s `langDir` resolves relative to the `i18n/` directory).
> For that reason the vitest `~`/`@` aliases point to `app/`.

Key principles:

- **Data comes entirely from the database API**, with no static data fallback on the frontend. Concerts, cities, and wishes are all fetched from `/api/*`.
- **Zero-request language switching**: Frontend `useI18n` + `pickLocale` derives from already-fetched **multilingual data** (zh / en / zh-Hant), no additional requests.
- **Multilingual SEO**: `app/app.vue` uniformly outputs `<html lang>`, 3-language `hreflang` (with `x-default`) and `og:locale` / `og:locale:alternate`; per-page `title` / `description` are emitted by `app/pages/index.vue` per locale.
- **Remote Turso as the authoritative database**: Online (Vercel) connects to the remote database via `NUXT_TURSO_DATABASE_URL=libsql://...`; local development can fall back to `file:` SQLite.

---

## 2. Technology Stack

| Category | Technology |
|------|------|
| Framework | Nuxt 4 (`^4.5`), Vue 3 (`^3.5`), Vue Router 5 |
| Database | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt` (config-driven Service Worker, `/api/*` NetworkFirst) |
| Multilingual | `@nuxtjs/i18n` v10 (3 languages: zh / en / zh-Hant, `strategy: prefix_except_default`, default zh has no prefix) |
| Language | TypeScript (`strict` enabled, `typeCheck: false` at build time) |
| Animation | GSAP 3.12.2 (CDN) |
| Styling | Tailwind CSS (CDN), Font Awesome 6.4.0 (CDN), `public/css/*.css` |
| SEO | Nuxt built-in `useSeoMeta` / `useHead` (multilingual hreflang / og:locale) + static `robots.txt` / `sitemap.xml` |
| Testing | Vitest (unit tests, node environment, 10 files / 143 cases) + `verify-seo.mjs` (SSR head validation script) |

### Core Dependencies (package.json)

- `@libsql/client`: Turso / SQLite client
- `@vite-pwa/nuxt`: PWA / Service Worker
- `@nuxtjs/i18n` (v10): multilingual routing / SEO / vue-i18n integration
- `nuxt`, `vue`, `vue-router`: Framework
- Dev dependencies: `vitest`, `typescript`, `@types/node`

---

## 3. Directory Structure

```
ilive_neo/
├── nuxt.config.ts             # Nuxt master config (SSR/runtimeConfig/head/PWA/SEO)
├── app/                       # [Nuxt 4 srcDir] Application layer
│   ├── app.vue                # Root component (NuxtPage + global error handling + site-wide language SEO: html lang/hreflang/og:locale)
│   ├── pages/
│   │   └── index.vue          # Homepage (Vue component, composables-driven + dynamic meta per locale)
│   ├── composables/           # [Core] All interaction logic (Vue composables)
│   │   ├── useData.ts         # SSR requests /api/data?lang= per current locale (pass-through when server-localized, else localizeConcert) + like override
│   │   ├── useI18n.ts         # zh / en / zh-Hant switching (useState lazy initialization)
│   │   ├── useGallery.ts      # Image gallery (lazy-cached localizedConcerts)
│   │   ├── useSonglist.ts     # Song list modal
│   │   ├── useTimeline.ts     # Timeline rendering
│   │   ├── useNavigation.ts   # Section navigation scrolling
│   │   ├── useTicketModal.ts  # Ticket modal
│   │   ├── useAlbumShowcase.ts  # Album showcase carousel (GSAP)
│   │   ├── useMusic.ts        # Background music play/pause
│   │   ├── useKeyboard.ts     # Keyboard gestures
│   │   ├── useSharedState.ts  # Cross-component shared state (useState wrapper)
│   │   ├── useFriendLink.ts   # Friend links
│   │   └── useAppError.ts     # Global error handling + Toast
│   ├── plugins/
│   │   └── statis.client.ts   # Third-party analytics injection (Baidu/GA/51.la, client-side plugin)
│   ├── types/
│   │   └── index.ts           # Frontend data types (Locale / Localized* / Concert / City / Wish / AppData, etc.)
│   └── utils/
│       ├── config.ts          # Global configuration constants CONFIG
│       ├── index.ts           # Utility functions (safeHtml / time formatting / pickLocale / localize* / computeCityConcertCounts)
│       └── seo.ts             # SEO pure functions (hreflang links / og:locale / multilingual description templates and artist separators)
├── i18n/                      # [Root] Locale messages (@nuxtjs/i18n v10 layout, langDir resolves relative to this dir)
│   └── locales/               # zh-CN.ts · en.ts · zh-Hant.ts (per-language messages)
├── public/                    # Static assets
│   ├── css/  main.css
│   ├── img/  logo.jpg
│   ├── music/ bgm_cn.mp3 · bgm_en.mp3
│   ├── concert/  Posters and live photos
│   ├── robots.txt             # Crawler rules + sitemap reference
│   └── sitemap.xml            # Sitemap (currently only the default-language homepage; multilingual hreflang is emitted by page useHead)
├── server/                    # Nitro server-side
│   ├── api/
│   │   ├── data.get.ts        # GET /api/data: aggregation (concerts/cities/wishes/stats/seo/friendLinks + likes)
│   │   ├── like.post.ts       # POST /api/like (like/unlike a concert, deduped by IP)
│   │   └── concerts/[id].get.ts  # GET /api/concerts/:id (single concert details + likes/liked)
│   ├── lib/
│   │   ├── turso.ts           # LibSQL client singleton (file:/libsql: switching; writes only for likes)
│   │   ├── concertLikes.ts    # Like read/write (count aggregation / per-IP query / toggle)
│   │   └── mappers.ts         # DB row (*_i18n JSON columns) → multilingual structure mapping (parseI18n / mapConcert / fetchAllConcerts)
│   ├── plugins/
│   │   └── init-db.ts         # Idempotent initialization on Nitro startup (skipped for remote Turso)
│   └── db/
│       ├── schema.sql         # Table structure (7 tables, translatable fields are *_i18n JSON columns)
│       ├── seed.mjs           # Empty database creation script (DROP + CREATE, no business data)
│       └── migrate-likes.mjs  # Idempotent migration for the denormalized concerts.likes column
├── verify-seo.mjs · dump-head.mjs · html-head.mjs   # SSR head / SEO validation scripts (run directly via node)
├── test/                      # Tests
│   ├── unit/                  # Vitest unit tests (safeHtml / time formatting / config / mappers / localize / i18n+SEO / friend-links / concertLikes)
│   ├── ui-tests.md            # UI acceptance checklist (manual + automated)
│   └── unit-tests.md / README.md
└── doc/
    ├── README_DEV.md          # This document (Chinese)
    └── README_DEV_EN.md       # This document (English)
```

---

## 4. Core Architecture & Data Flow

### 4.1 Frontend Bootstrap Chain (Vue-based)

No more classic script injectors. The page is driven directly by `app/pages/index.vue`'s `<script setup>`:

```
app/pages/index.vue (setup)
  ├─ useData()           → useAsyncData('app-data') prefetches GET /api/data during SSR
  │                       → useState caches concerts/cities/wishes/stats
  │                       → localizedConcerts and other computed values derive single-language structures by currentLanguage
  ├─ useI18n()            → currentLanguage (useState lazy initialization), switching only recalculates derived values
  ├─ useMusic()           → Background music (initialized in onMounted, follows language track switching)
  ├─ useGallery()         → Gallery (lazy-fetches localizedConcerts once, avoids duplicating useData)
  ├─ useAlbumShowcase()   → Album carousel (GSAP)
  ├─ useNavigation()/useKeyboard()/useSonglist()/useTicketModal()/useTimeline()/useFriendLink()
  ├─ useSeoMeta()         → Dynamic title/description/og/twitter (switches with locale + database artists)
  └─ onMounted            → initLanguage/initBgMusic/startDynamicTextTimers/initDataLayout

app/app.vue (setup)
  └─ useHead + useI18n    → Site-wide language SEO: <html lang>, 3-language hreflang (incl. x-default),
                            og:locale / og:locale:alternate; language-independent static meta stays in nuxt.config.ts
```

Key points:

- **All `useState`/`useAsyncData` inside composables must be lazy-initialized** (called within the composable function body, never at module level), otherwise SSR throws `instance unavailable`.
- **Language switching does NOT re-request the API**: `localizedConcerts` and other computed values depend on `currentLanguage`; switching only recalculates frontend-derived values with zero network requests.
- `app/pages/index.vue`'s `<script setup>` carries all interaction logic + dynamic SEO meta; site-wide language SEO (`<html lang>` / hreflang / `og:locale`) is emitted by `app/app.vue`, and both sides merge by the same `key` to avoid duplicate meta in the head.

### 4.2 Server-Side Data Layer (Single Endpoint)

- `GET /api/data` (`server/api/data.get.ts`): **Single-endpoint aggregation**, returns `{ concerts, cities, wishes, stats }` in one response. City concert counts reuse the same concerts data via `computeCityConcertCounts`, eliminating the original multi-endpoint redundant full-table queries.
- `server/lib/mappers.ts`: `fetchAllConcerts` maps normalized DB rows (`*_i18n` JSON columns) into **multilingual structures** (`artist: { zh, en, 'zh-Hant' }`, `location` / `tags` / `songlist` are isomorphic, parsed by `parseI18n` / `joinLocation`); `computeCityConcertCounts` calculates concert counts per city. `mapConcert` is `export`ed for unit testing.
- Frontend `useData.ts`'s `pickLocale` / `localizeConcert` **selects single-language fields** from multilingual structures based on `currentLanguage` (e.g., `artist: "Mayday"`); when the target language is missing it falls back via `requested language → zh → en` (`app/utils/index.ts`, pure functions, directly unit-testable).

```
useAsyncData('app-data') → GET /api/data
  ├─ concerts[]   (multilingual: artist.{zh,en,zh-Hant}, location isomorphic, ...)
  ├─ cities[]     (name multilingual + icon + concerts count)
  ├─ wishes[]     (content multilingual + likes + liked)
  └─ stats        { totalConcerts, totalArtists, totalCities }
        ↓
localizedConcerts (computed, selects single language by currentLanguage)
```

- `server/lib/turso.ts`: `getTursoClient()` lazily creates a global singleton client. Auto-switches based on `runtimeConfig.turso.databaseUrl`:
  - `libsql://xxx.turso.io` → Remote Turso (production/online, requires `NUXT_TURSO_AUTH_TOKEN`)
  - `file:./public/data/data.db` → Local SQLite (development fallback)
  - All project APIs are SELECT (read-only) except the like endpoints; `createClient` does not apply `readOnly`.
- `server/plugins/init-db.ts`: Idempotent initialization on Nitro startup — **only creates empty tables when using local `file:` and the `concerts` table does not exist**; **remote Turso skips directly** (avoids accidentally creating a local empty database).

### 4.3 Dynamic SEO Meta Information

In `app/pages/index.vue`:

- `useSeoMeta` dynamically outputs title/description/og/twitter following `currentLanguage`.
- **keywords/description are dynamically generated from database artists**: `localizedConcerts` extracts deduplicated `artist`, auto-updates as concerts are added or removed.
- `useHead` (only `import.meta.server`) injects **JSON-LD structured data** (WebSite + Person + ItemList + MusicEvent) + **hreflang** (3 languages + `x-default`, merged by the same key as `app.vue` to dedupe).
- JSON-LD uses `JSON.parse(JSON.stringify(toRaw(...)))` to strip Vue reactive Proxy, and uses `computed` to ensure the complete concert list is output after data is ready.

---

## 5. Database

### 5.1 Table Structure (`server/db/schema.sql`)

| Table | Description |
|----|------|
| `concerts` | Concert main table (translatable fields are `*_i18n` JSON columns; also holds the denormalized `likes` count) |
| `concert_tags` | Concert tags (`concert_id` FK, `tag_i18n`) |
| `concert_images` | Concert images (`src` + `alt_i18n`) |
| `concert_songlist` | Concert song list (`seq` ordering + `name_i18n` + `link`) |
| `cities` | Cities table (`name_i18n` + `icon`) |
| `wishes` | Wishes wall (`content_i18n` + `likes` + `liked`) |
| `concert_likes` | Concert likes (`concert_id` + `ip` + `created_at`, `UNIQUE(concert_id, ip)` — one per IP, togglable) |

All translatable fields are unified as **`*_i18n` JSON columns**, shaped like `{"zh":"…","en":"…","zh-Hant":"…"}` (parsed by `parseI18n`; `zh` is the base language, missing languages fall back at the UI layer; legacy `ja`/`ko` keys from old databases are not shown). `location` is split into four segments `country/province/city/venue` and reassembled per language as **`Country · Province · City · Venue`** during mapping (`mappers.ts`'s `joinLocation` / `mapLocationDetail`, empty segments auto-omitted, no cross-language fallback).

### 5.2 Initialization

```bash
npm run db:seed   # or npm run db:init (equivalent) — DROP then CREATE, resulting in an empty database
```

`seed.mjs` **DROP then CREATEs** (in foreign key dependency order), resulting in an empty database. Business data is imported externally (SQL / tools); the script itself does not populate data.

Schema changes treat `schema.sql` as the **single source of truth**: historical one-off migrations (bilingual columns → `*_i18n`, etc.) have been removed, and existing databases (local `data.db` / production Turso, requiring `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN` with **write access**) should be aligned to `schema.sql` and business needs. The only retained migration is the idempotent `server/db/migrate-likes.mjs` — it adds the denormalized `likes` column to `concerts` and backfills the baseline (because `ALTER TABLE` has no `IF NOT EXISTS`).

---

## 6. Environment Variables

### 6.1 Configuration

| Variable | Description | Default |
|------|------|--------|
| `NUXT_TURSO_DATABASE_URL` | Database URL (`libsql:` remote or `file:` local) | `file:./public/data/data.db` |
| `NUXT_TURSO_AUTH_TOKEN` | Remote Turso auth token | Empty |

> **Critical**: Must use the **`NUXT_` prefix**, Nuxt will override `runtimeConfig.turso.*` at **runtime**. If using the `TURSO_` prefix, `process.env` may not be readable during `nuxt.config.ts` evaluation, causing fallback to the local `file:` default.

### 6.2 Local Development (`.env`)

```bash
# Remote Turso (recommended)
NUXT_TURSO_DATABASE_URL=libsql://your-db-name.turso.io
NUXT_TURSO_AUTH_TOKEN=your-token

# Or local SQLite (no registration required)
# NUXT_TURSO_DATABASE_URL=file:./public/data/data.db
```

> ⚠️ Nuxt 4 (since 3.15) **only loads `.env`, not `.env.local`**. Configuration must be placed in `.env`.
> ⚠️ `.env` contains secrets, **must be added to `.gitignore` and never committed**. If tracked by `git ls-files`, immediately `git rm --cached .env` and **rotate the token** (historical commits still retain old tokens).

### 6.3 Vercel Deployment (Environment Variables)

Configure in Vercel project dashboard **Settings → Environment Variables**:

```
NUXT_TURSO_DATABASE_URL=libsql://your-db-name.turso.io
NUXT_TURSO_AUTH_TOKEN=your-token
```

`.env` is not uploaded (gitignore ignores it); Vercel build/runtime relies on these dashboard variables to connect to Turso.

---

## 7. Development Commands

```bash
npm install        # Install dependencies (includes postinstall: nuxt prepare)
npm run dev        # Start development server (default http://localhost:3000/)
npm run build      # Production build (Nitro, deployable to Vercel)
npm run preview    # Preview production build
npm run generate   # Generate static site (SSG)
npm run db:seed    # Initialize local empty database (DROP + CREATE, ⚠️ destructive)
npm run test       # Run unit tests (vitest run, 10 files / 143 cases)
npm run test:watch # Run tests in watch mode
```

---

## 8. API Reference

| Method | Path | Description |
|------|------|------|
| GET | `/api/data` | Single-endpoint aggregation: concerts (with `likes` / `liked`) + cities + wishes + stats + SEO + friend links; optional `?lang=<locale>` returns single-locale results and the response carries a `locale` field (= requested locale, or null) |
| GET | `/api/concerts/:id` | Single concert details (incl. tags/images/songlist and `likes` / `liked`), 400 for invalid id, 404 for not found |
| POST | `/api/like` | Like/unlike a concert (body `{ id }`, deduped by IP, togglable); returns `{ id, likes, liked }`; 400 / 404 on errors |

> Like counts ride along with `/api/data` (no extra GET). To avoid leaking a per-IP `liked` flag through the shared
> cache, `/api/data` is split into a cached shared layer (counts included) plus a non-cached per-IP merge layer.

---

## 9. SEO

### 9.1 Static Configuration (`nuxt.config.ts`)

- `SITE_URL = 'https://ilive.lyc.la'`, og:url / canonical / og:image / twitter:image unified as **https**.
- `app.head` keeps only **language-independent** static info: `author` / `robots` / `referrer` / `og:type` / `og:url` / `og:image` / `twitter:card` / `twitter:site` / `twitter:creator` / `twitter:image`, plus favicon / stylesheet / GSAP resource references.
- The originally hard-coded Chinese `title` / `keywords` / `description` / `og:title` / `og:description` / `twitter:title` / `twitter:description` have all been **removed** (to avoid duplicating or conflicting with page-level `useSeoMeta`).
- Language-related meta: `og:locale` / `og:locale:alternate` are emitted by `app/app.vue`; `og:site_name` is emitted by page-level `useSeoMeta`.

### 9.2 Static Files

- `public/robots.txt`: Allows all crawlers, `Disallow: /api/`, references sitemap.
- `public/sitemap.xml`: Currently only the default-language homepage (`https://ilive.lyc.la/`, with one `zh-CN` `xhtml:link` alternate). 3-language hreflang is emitted by `app/app.vue` and `app/pages/index.vue` in the page head, and does not depend on the sitemap.

### 9.3 Dynamic Meta Information (`app/pages/index.vue`)

- `useSeoMeta`: Outputs title/description/og/twitter following language; keywords/description dynamically generated from database artists (5-language description templates in `app/utils/seo.ts`).
- JSON-LD: WebSite + Person + ItemList + MusicEvent (per concert).
- hreflang: `zh-CN` / `en` / `zh-Hant` + `x-default` (default language `zh` href is `https://ilive.lyc.la/`, no `/zh` prefix).
- `<html lang>` and `og:locale` / `og:locale:alternate`: emitted uniformly by `app/app.vue` (`app/utils/seo.ts`'s `LOCALE_LANG` / `toOgLocale` / `buildHreflangLinks` pure functions).

---

## 10. PWA / Service Worker

Configuratively generated by `@vite-pwa/nuxt` in the `pwa` field of `nuxt.config.ts`:

- `registerType: 'autoUpdate'`, `injectRegister: 'inline'`
- `devOptions.enabled: false` (SW disabled by default in development)
- Workbox runtime caching strategies:
  - Images: `StaleWhileRevalidate`
  - CSS/JS: `NetworkFirst`
  - `/api/*`: `NetworkFirst` (ensures real-time fetch from database, offline fallback to cache)

### 10.1 Image Lazy-Loading & Responsive Optimization

The site ships 300+ static jpgs (posters + gallery). Already in place:

- **3D album covers** (`app/pages/index.vue`): the selected cover (the first-screen LCP candidate) uses `loading="eager"` + `fetchpriority="high"`; off-screen covers use `loading="lazy"` + `fetchpriority="low"`; all keep `decoding="async"`.
- **Gallery thumbnails**: `loading="lazy"` + `decoding="async"`; `.gallery-item` has fixed `width/height` (120×80, 100×67 on mobile) to prevent CLS.
- **Ticket poster**: CSS `background-image` on `.ticket-modal` (default `display:none`), loaded only when the modal opens, so it never blocks first-screen loading.

> Optional follow-ups (asset-level rework, not yet implemented): transcode jpgs to **WebP/AVIF** and use `<picture>` + `srcset` for resolution adaptation; or adopt `@nuxt/image` to unify responsive images and transcoding. Benefits depend on the build/deploy pipeline; larger change, evaluate on demand.



---

## 12. Deployment (Vercel)

1. Configure `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN` in Vercel dashboard.
2. Bind domain `ilive.lyc.la` (Vercel automatically provides HTTPS SSL).
3. Push code, Vercel executes `nuxt build` to generate Nitro serverless output.
4. `public/robots.txt` / `sitemap.xml` will be packaged as static files by Nitro.
5. After first deployment, visit `/api/data` to confirm remote Turso data is returned.

---

## 13. Notes

- `file:` local database relative paths are resolved based on `process.cwd()` (Nuxt root); do not run elsewhere to avoid database file location drift.
- `init-db.ts` uses `process.cwd() + 'server/db/schema.sql'` to locate the schema, because after Nitro compilation, `__dirname` points to the build output rather than the source tree.
- All `useState`/`useAsyncData` must be inside composable function bodies (lazy initialization), **module-level calls are prohibited**, otherwise SSR throws `instance unavailable`.
- **Environment variables must use the `NUXT_` prefix**; the `TURSO_` prefix may not be readable during config evaluation.
- **Remote Turso skips database creation in `init-db.ts`**, avoiding accidentally creating local empty database files.
- `concert_likes` now has an index `idx_concert_likes_ip` (speeds up per-IP like-set/count lookups). **Existing local databases** must manually run `CREATE INDEX IF NOT EXISTS idx_concert_likes_ip ON concert_likes(ip);` after the schema change (or rebuild via `db:seed --force`) for it to take effect.
- The client `useData` now requests `/api/data?lang=<locale>` per current locale (key carries the locale for per-language caching). `localizedConcerts/Cities/Wishes` pass through when the server already localized, otherwise `localizeConcert` runs client-side; `counts` reads the server-precomputed `city.concertCount` in single-locale mode (no cross-locale recompute).
- After modifying `public/css/*` or `app/pages/index.vue`, no manual cache manifest maintenance is needed (Workbox runtime caching); PWA's `autoUpdate` handles updates automatically.
- **Token security**: `.env` is added to `.gitignore`. If a token was ever committed to git history, immediately **rotate to a new token** in the Turso dashboard.

---

## 14. Security: Client IP & Like Rate Limiting

Likes are deduplicated per IP (`UNIQUE(concert_id, ip)`) — one vote per user — and drive the "hot top 3". If the IP is spoofable, an attacker can like infinitely and poison the ranking.

### 14.1 Spoof-proof client IP

- **Never** trust the leftmost `X-Forwarded-For` entry unconditionally: `getRequestIP(event, { xForwardedFor: true })` reads the client-supplied leftmost XFF, which an attacker can forge — on a direct deploy they can impersonate arbitrary IPs and bypass dedup.
- All IP resolution now goes through `getClientIp(event)` (`server/lib/concertLikes.ts`), whose logic is:
  - Trust `X-Forwarded-For` (via `getRequestIP(event, { xForwardedFor: true })`) only when `NUXT_TRUST_PROXY=true`;
  - Otherwise (default, including direct deploy) fall back to the TCP peer `socket.remoteAddress` — supplied by the OS, not forgeable by the client.
- **Direct deploy**: leave `NUXT_TRUST_PROXY` unset (off by default) → the IP is the socket address, inherently not spoofable.
- **Behind a reverse proxy / CDN (Vercel, Cloudflare, nginx, …)**: set `NUXT_TRUST_PROXY=true`. **Prerequisite**: the proxy must **overwrite** (not append to) `X-Forwarded-For` with the real client IP (e.g. nginx `proxy_set_header X-Forwarded-For $remote_addr;`). If it only appends, the leftmost entry may still carry a forged value.

### 14.2 Like rate limiting

- `server/lib/rateLimit.ts`: at most 10 requests per IP per 60s (`rateLimit(ip)`); on exceed returns `429` with `Retry-After` (seconds).
- Pure in-memory, zero-dependency, effective within a single process; empty buckets are pruned automatically (no memory leak).
- **Serverless caveat**: on Vercel / cloud functions each instance has its own memory and resets on cold start, so the limit applies only within a single instance and is not shared across instances. For global accuracy, use a shared store (e.g. Redis) and add another layer at the proxy / CDN (e.g. Cloudflare Rate Limiting).
- Thresholds are overridable at the call site: `rateLimit(ip, { windowMs, max })`.


