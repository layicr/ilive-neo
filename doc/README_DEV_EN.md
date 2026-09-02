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
> `composables/`, `plugins/`, `utils/`, `locales/` and `types/` all live under `app/`;
> `server/`, `public/`, `test/` and `nuxt.config.ts` stay at the project root.
> For that reason the vitest `~`/`@` aliases point to `app/`.

Key principles:

- **Data comes entirely from the database API**, with no static data fallback on the frontend. Concerts, cities, and wishes are all fetched from `/api/*`.
- **Zero-request language switching**: Frontend `useI18n` + `pickText` derives from already-fetched bilingual data, no additional requests.
- **Remote Turso as the authoritative database**: Online (Vercel) connects to the remote database via `NUXT_TURSO_DATABASE_URL=libsql://...`; local development can fall back to `file:` SQLite.

---

## 2. Technology Stack

| Category | Technology |
|------|------|
| Framework | Nuxt 4 (`^4.5`), Vue 3 (`^3.5`), Vue Router 5 |
| Database | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt` (config-driven Service Worker, `/api/*` NetworkFirst) |
| Language | TypeScript (`strict` enabled, `typeCheck: false` at build time) |
| Animation | GSAP 3.12.2 (CDN) |
| Styling | Tailwind CSS (CDN), Font Awesome 6.4.0 (CDN), `public/css/*.css` |
| SEO | Nuxt built-in `useSeoMeta` / `useHead` + static `robots.txt` / `sitemap.xml` |
| Testing | Vitest (unit tests, node environment, 43 test cases) |

### Core Dependencies (package.json)

- `@libsql/client`: Turso / SQLite client
- `@vite-pwa/nuxt`: PWA / Service Worker
- `nuxt`, `vue`, `vue-router`: Framework
- Dev dependencies: `vitest`, `typescript`, `@types/node`

---

## 3. Directory Structure

```
ilive_neo/
├── nuxt.config.ts             # Nuxt master config (SSR/runtimeConfig/head/PWA/SEO)
├── app/                       # [Nuxt 4 srcDir] Application layer
│   ├── app.vue                # Root component (renders <NuxtPage/> + global error handling)
│   ├── pages/
│   │   └── index.vue          # Homepage (Vue component, composables-driven + dynamic SEO meta)
│   ├── composables/           # [Core] All interaction logic (Vue composables)
│   │   ├── useData.ts         # SSR prefetch /api/data + single-language derivation (pickText/localizeConcert)
│   │   ├── useI18n.ts         # Chinese/English switching (useState lazy initialization)
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
│   ├── locales/               # Static UI copy (Chinese/English literals, not database content)
│   │   ├── zh.ts
│   │   └── en.ts
│   ├── types/
│   │   └── index.ts           # Frontend data types (Bilingual* / Concert / AppData, etc.)
│   └── utils/
│       ├── config.ts          # Global configuration constants CONFIG
│       └── index.ts           # Utility functions (safeHtml / formatWishTime)
├── public/                    # Static assets
│   ├── css/  main.css
│   ├── img/  logo.jpg
│   ├── music/ bgm_cn.mp3 · bgm_en.mp3
│   ├── concert/  Posters and live photos
│   ├── robots.txt             # Crawler rules + sitemap reference
│   └── sitemap.xml            # Sitemap (with zh/en hreflang)
├── server/                    # Nitro server-side
│   ├── api/
│   │   ├── data.get.ts        # GET /single-endpoint aggregation: concerts/cities/wishes/stats
│   │   └── concerts/[id].get.ts  # GET /api/concerts/:id (single concert details)
│   ├── lib/
│   │   ├── turso.ts           # LibSQL client singleton (file:/libsql: switching, read-only)
│   │   └── mappers.ts         # DB row → bilingual structure mapping + city concert count calculation
│   ├── plugins/
│   │   └── init-db.ts         # Idempotent initialization on Nitro startup (skipped for remote Turso)
│   └── db/
│       ├── schema.sql         # Table structure (6 tables)
│       └── seed.mjs           # Empty database creation script (DROP + CREATE, no business data)
├── test/                      # Tests
│   ├── unit/                 # Vitest unit tests (safeHtml/formatWishTime/config/mappers/localize)
│   ├── ui-tests.md           # UI acceptance checklist (manual + automated)
│   └── unit-tests.md / README.md
└── doc/
    └── README_DEV.md          # This document (Chinese)
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
  ├─ useSeoMeta()         → Dynamic title/description/og/twitter (switches with language + database artists)
  └─ onMounted            → initLanguage/initBgMusic/startDynamicTextTimers/initDataLayout
```

Key points:

- **All `useState`/`useAsyncData` inside composables must be lazy-initialized** (called within the composable function body, never at module level), otherwise SSR throws `instance unavailable`.
- **Language switching does NOT re-request the API**: `localizedConcerts` and other computed values depend on `currentLanguage`; switching only recalculates frontend-derived values with zero network requests.
- `app/pages/index.vue`'s `<script setup>` carries all interaction logic + dynamic SEO meta.

### 4.2 Server-Side Data Layer (Single Endpoint)

- `GET /api/data` (`server/api/data.get.ts`): **Single-endpoint aggregation**, returns `{ concerts, cities, wishes, stats }` in one response. City concert counts reuse the same concerts data via `computeCityConcertCounts`, eliminating the original multi-endpoint redundant full-table queries.
- `server/lib/mappers.ts`: `fetchAllConcerts` maps normalized DB rows into **bilingual structures** (`artist: { zh, en }`, `location: { zh, en }`, etc.); `computeCityConcertCounts` calculates concert counts per city.
- Frontend `useData.ts`'s `pickText` / `localizeConcert` **selects single-language fields** from bilingual structures based on `currentLanguage` (e.g., `artist: "Mayday"`).

```
useAsyncData('app-data') → GET /api/data
  ├─ concerts[]   (bilingual: artist.zh/en, location.zh/en, ...)
  ├─ cities[]     (name.zh/en + icon + concerts count)
  ├─ wishes[]     (content.zh/en + likes + liked)
  └─ stats        { totalConcerts, totalArtists, totalCities }
        ↓
localizedConcerts (computed, selects single language by currentLanguage)
```

- `server/lib/turso.ts`: `getTursoClient()` lazily creates a global singleton client. Auto-switches based on `runtimeConfig.turso.databaseUrl`:
  - `libsql://xxx.turso.io` → Remote Turso (production/online, requires `NUXT_TURSO_AUTH_TOKEN`)
  - `file:./public/data/data.db` → Local SQLite (development fallback)
  - All project APIs are SELECT (read-only); `createClient` does not apply `readOnly` configuration.
- `server/plugins/init-db.ts`: Idempotent initialization on Nitro startup — **only creates empty tables when using local `file:` and the `concerts` table does not exist**; **remote Turso skips directly** (avoids accidentally creating a local empty database).

### 4.3 Dynamic SEO Meta Information

In `app/pages/index.vue`:

- `useSeoMeta` dynamically outputs title/description/og/twitter following `currentLanguage`.
- **keywords/description are dynamically generated from database artists**: `localizedConcerts` extracts deduplicated `artist`, auto-updates as concerts are added or removed.
- `useHead` (only `import.meta.server`) injects **JSON-LD structured data** (WebSite + Person + ItemList + MusicEvent) + **hreflang** for Chinese and English versions.
- JSON-LD uses `JSON.parse(JSON.stringify(toRaw(...)))` to strip Vue reactive Proxy, and uses `computed` to ensure the complete concert list is output after data is ready.

---

## 5. Database

### 5.1 Table Structure (`server/db/schema.sql`)

| Table | Description |
|----|------|
| `concerts` | Concert main table (bilingual fields `*_zh` / `*_en`) |
| `concert_tags` | Concert tags (`concert_id` foreign key) |
| `concert_images` | Concert images (`src` + `alt_zh/en`) |
| `concert_songlist` | Concert song list (`seq` ordering + `link`) |
| `cities` | Cities table (`name_zh/en` + `icon`) |
| `wishes` | Wishes wall (`content_zh/en` + `likes` + `liked`) |

All bilingual fields follow the original `{zh,en}` structure. `location` is split into four segments: `country/province/city/venue`, and reassembled as **`Country · Province · City · Venue`** during mapping (`mappers.ts`'s `joinLocation`, empty segments auto-omitted).

### 5.2 Initialization

```bash
npm run db:seed   # or npm run db:init (equivalent) — DROP then CREATE, resulting in an empty database
```

`seed.mjs` **DROP then CREATEs** (in foreign key dependency order), resulting in an empty database. Business data is imported externally (SQL / tools); the script itself does not populate data.

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
npm run db:seed    # Initialize local empty database
npm run test       # Run unit tests (vitest run, 43 test cases)
npm run test:watch # Run tests in watch mode
```

---

## 8. API Reference

| Method | Path | Description |
|------|------|------|
| GET | `/api/data` | Single-endpoint aggregation: concert list + cities + wishes + stats `{ concerts, cities, wishes, stats }` |
| GET | `/api/concerts/:id` | Single concert details (including tags/images/songlist), 400 for invalid id, 404 for not found |

> The frontend actually only calls `/api/data` and `/api/concerts/:id` two endpoints.

---

## 9. SEO

### 9.1 Static Configuration (`nuxt.config.ts`)

- Imports `SITE_URL = 'https://ilive.lyc.la'`, og:url / canonical / og:image / twitter:image unified as **https**.
- Adds `og:site_name`, `og:locale` / `og:locale:alternate`, `twitter:site` / `twitter:creator`.

### 9.2 Static Files

- `public/robots.txt`: Allows all crawlers, `Disallow: /api/`, references sitemap.
- `public/sitemap.xml`: Includes homepage + zh/en hreflang versions.

### 9.3 Dynamic Meta Information (`app/pages/index.vue`)

- `useSeoMeta`: Outputs title/description/og/twitter following language, keywords/description dynamically generated from database artists.
- JSON-LD: WebSite + Person + ItemList + MusicEvent (per concert).
- hreflang: zh-CN / en / x-default.

---

## 10. PWA / Service Worker

Configuratively generated by `@vite-pwa/nuxt` in the `pwa` field of `nuxt.config.ts`:

- `registerType: 'autoUpdate'`, `injectRegister: 'inline'`
- `devOptions.enabled: false` (SW disabled by default in development)
- Workbox runtime caching strategies:
  - Images: `StaleWhileRevalidate`
  - CSS/JS: `NetworkFirst`
  - `/api/*`: `NetworkFirst` (ensures real-time fetch from database, offline fallback to cache)

---

## 11. Testing

### 11.1 Unit Tests (Vitest)

```bash
npm run test
```

Covers pure functions (`node` environment, no DOM), **43 test cases** total:

- `safeHtml.test.ts` (11 cases): HTML sanitization
- `formatWishTime.test.ts` (5 cases): Wish time formatting
- `config.test.ts` (4 cases): CONFIG field correctness
- `mappers.test.ts` (12 cases): DB row → bilingual structure mapping (including country-prefixed location)
- `localize.test.ts` (11 cases): Bilingual → Concert localization

Configuration in root `vitest.config.ts` (node environment, `~`/`@` aliases configured to resolve Nuxt paths).

### 11.2 UI Acceptance (`test/ui-tests.md`)

Manual + automated acceptance checklist, covering homepage SSR, stats cards, bilingual switching, API endpoints (including 404/400 error codes), etc.

### 11.3 Nuxt Environment-Dependent Tests

Composables relying on `useState/useAsyncData` (e.g., useData localization, useI18n switching) require a Nuxt test environment and are not yet included; `@nuxt/test-utils` can be introduced if needed.

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
- After modifying `public/css/*` or `app/pages/index.vue`, no manual cache manifest maintenance is needed (Workbox runtime caching); PWA's `autoUpdate` handles updates automatically.
- **Token security**: `.env` is added to `.gitignore`. If a token was ever committed to git history, immediately **rotate to a new token** in the Turso dashboard.
