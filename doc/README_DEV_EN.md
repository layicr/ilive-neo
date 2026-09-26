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
| Styling | `public/css/main.css` (includes hand-written utilities migrated from Tailwind CDN), Font Awesome 6.4.0 (CDN) |
| SEO | Nuxt built-in `useSeoMeta` / `useHead` (multilingual hreflang / og:locale) + static `robots.txt` / `sitemap.xml` |
| Testing | Vitest (unit tests, happy-dom, **24 files / 334 cases**) + Playwright (E2E, **6 suites / 54 cases**) + `verify-seo.mjs` (SSR head validation script) |

### Core Dependencies (package.json)

- `@libsql/client`: Turso / SQLite client
- `@vite-pwa/nuxt`: PWA / Service Worker
- `@nuxtjs/i18n` (v10): multilingual routing / SEO / vue-i18n integration
- `nuxt`, `vue`, `vue-router`: Framework
- Dev dependencies: `vitest`, `@vue/test-utils`, `happy-dom`, `@nuxt/test-utils`, `@playwright/test`, `playwright`, `typescript`, `@types/node`

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
│   │   ├── useCountUp.ts      # Statistic count-up (0 → target, easeOutCubic 5s, replay every 120s; SSR passes through the real value, hydration-safe)
│   │   ├── useFriendLink.ts   # Friend links
│   │   ├── useGuestbook.ts    # Guestbook (paginated list / post message / post reply / card·list view)
│   │   └── useAppError.ts     # Global error handling + Toast
│   ├── plugins/
│   │   └── statis.client.ts   # Third-party analytics injection (Baidu/GA/51.la, client-side plugin)
│   ├── types/                 # Frontend data types (i18n / concert / city / wish / friendLink / guestbook / seo)
│   │   ├── index.ts           # Barrel re-exports (Locale / Localized* / Concert / City / Wish / AppData, etc.)
│   │   └── guestbook.ts       # Guestbook domain models (GuestbookMessage / GuestbookReply / GuestbookPage)
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
│   ├── data/data.db           # Local SQLite (development fallback; production uses remote Turso)
│   ├── robots.txt             # Crawler rules + sitemap reference
│   └── sitemap.xml            # Sitemap (currently only the default-language homepage; multilingual hreflang is emitted by page useHead)
├── server/                    # Nitro server-side
│   ├── api/
│   │   ├── data.get.ts        # GET /api/data: aggregation (concerts/cities/wishes/stats/seo/friendLinks + likes)
│   │   ├── like.post.ts       # POST /api/like (like/unlike a concert, deduped by IP)
│   │   ├── concerts/[id].get.ts  # GET /api/concerts/:id (single concert details + likes/liked)
│   │   ├── guestbook.get.ts   # GET /api/guestbook (paginated approved messages + their replies)
│   │   ├── guestbook.post.ts  # POST /api/guestbook (post a message, auto-approved)
│   │   └── guestbook/reply.post.ts  # POST /api/guestbook/reply (post a reply, validates the parent message)
│   ├── lib/
│   │   ├── turso.ts           # LibSQL client singleton (file:/libsql: switching)
│   │   ├── db-config.ts       # Local file: database path resolution (defaults to public/data/data.db)
│   │   ├── mappers.ts         # Data mapping barrel (re-exports parse/concerts/seo/friendLinks/concertLikes/guestbook)
│   │   ├── parse.ts           # i18n JSON column parsing (parseI18n / parseTags / has; never throws)
│   │   ├── concerts.ts        # Concert row types + mapConcert / fetchConcert / fetchAllConcerts
│   │   ├── seo.ts             # SEO_I18N_KEYS / SEO_FALLBACK / fetchSiteSeo (DB-first + code fallback)
│   │   ├── friendLinks.ts     # Friend link mapping (with href protocol allow-list sanitizeHref)
│   │   ├── concertLikes.ts    # Like read/write (toggle inside a transaction + COUNT(*) self-healing recompute of the denormalized column) + getClientIp (per-IP dedupe, togglable)
│   │   ├── guestbook.ts       # Message/reply read/write (approved only; parent validation; batched IN replies, no N+1)
│   │   ├── ua.ts              # Server-side UA parsing (browser / OS)
│   │   ├── rateLimit.ts       # Per-IP in-memory rate limiter (shared by likes and guestbook writes)
│   │   └── locales.ts         # Locale definitions (LOCALES)
│   ├── plugins/
│   │   └── init-db.ts         # Idempotent initialization on Nitro startup (skipped for remote Turso)
│   └── db/
│       ├── schema.sql         # Table structure (12 tables, translatable fields are *_i18n JSON columns)
│       └── seed.mjs           # Empty database creation script (DROP + CREATE, no business data)
├── verify-seo.mjs · dump-head.mjs · html-head.mjs   # SSR head / SEO validation scripts (run directly via node)
├── test/                      # Tests
│   ├── unit/                  # Vitest unit tests (24 files / 334 cases)
│   ├── e2e/                   # Playwright end-to-end tests (6 suites / 54 cases, desktop/mobile projects + fixture DB seed)
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
  ├─ useCountUp()         → Statistic card count-up (cities/artists/concerts; plays from 0 after mount, replays every 120s)
  ├─ useNavigation()/useKeyboard()/useSonglist()/useTicketModal()/useTimeline()/useFriendLink()/useGuestbook()
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
- **Statistic count-up (`app/composables/useCountUp.ts`)**: the displayed value is a `computed` — while not playing it **lazily passes through** the target. Never snapshot the target during setup: `useAsyncData` has not resolved yet at SSR time, so a snapshot yields 0, making the SSR HTML emit 0 and mismatching on hydration. After `onMounted` the next frame resets to 0 and plays (default 5s, easeOutCubic); pass `repeatMs` for periodic replay (120s on the homepage); `prefers-reduced-motion` skips the animation and shows the final value.
- **Context-safe error toasts (`app/composables/useAppError.ts`)**: vue-i18n's `useI18n()` **throws** `Must be called at the top of a 'setup' function` when there is no component instance. The error-copy resolver is therefore **registered during setup only** and reused afterwards, so `handleError(err, ctx, showUser=true, messageKey)` is safe from watch / event callbacks / global listeners — never resolve i18n directly inside a callback.
- **Timeline observer lifecycle (`app/composables/useTimeline.ts`)**: an `IntersectionObserver` holds **strong references** to observed nodes. It is disconnected and nulled when the owner unmounts (`onScopeDispose`), and every `initTimelineReveal()` disconnects before re-observing the current DOM — otherwise old DOM / image nodes survive a locale-switch page rebuild.

### 4.2 Server-Side Data Layer

- `GET /api/data` (`server/api/data.get.ts`): **Single-endpoint aggregation**, returns `{ concerts, cities, wishes, stats }` in one response. City concert counts reuse the same concerts data via `computeCityConcertCounts`, eliminating the original multi-endpoint redundant full-table queries.
- **Two-layer caching + response cache policy**: the inner `defineCachedEventHandler` (1h SWR in production) emits only request-agnostic shared data; the outer, non-cached layer merges `liked` per IP. Two things matter:
  1. The inner layer writes the cache entry's own `cache-control` (`s-maxage=3600`) onto the very same event response, so **the outer layer must explicitly override it to `private, no-store`** — otherwise a CDN / edge / nginx would cache one visitor's per-IP `liked` state for an hour and serve it to everyone. `etag` / `last-modified` are kept so conditional requests still work.
  2. On a conditional request (`If-None-Match` / `If-Modified-Since`), Nitro writes 304 itself, ends the response and returns **`undefined`** to the caller, so the outer layer must null-check before dereferencing (otherwise it throws a `TypeError` in production; dev uses the uncached branch and never reproduces it).
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

- Guestbook (`server/lib/guestbook.ts`): two tables — `guestbook` (messages) + `guestbook_reply` (replies). Writes set `is_approved=1` (auto-approved); a reply first validates that its parent message exists and is approved (otherwise returns `null` → HTTP 404). Reads return only approved content, and this page's replies are fetched in a single `IN (...)` batch (no N+1). Emails are stored but never returned; browser/OS/IP are collected server-side (`ua.ts` / `getClientIp`).
- `server/lib/turso.ts`: `getTursoClient()` lazily creates a global singleton client. Auto-switches based on `runtimeConfig.turso.databaseUrl`:
  - `libsql://xxx.turso.io` → Remote Turso (production/online, requires `NUXT_TURSO_AUTH_TOKEN`)
  - `file:./public/data/data.db` → Local SQLite (development fallback)
  - Writes are limited to likes (`/api/like`) and the guestbook (`/api/guestbook`, `/api/guestbook/reply`); all other endpoints are SELECT. `createClient` does not apply `readOnly`.
- `server/plugins/init-db.ts`: Idempotent initialization on Nitro startup — **only creates empty tables when using local `file:` and the `concerts` table does not exist**; **remote Turso skips directly** (avoids accidentally creating a local empty database).

### 4.3 Dynamic SEO Meta Information

In `app/pages/index.vue`:

- `useSeoMeta` dynamically outputs title/description/og/twitter following `currentLanguage`.
- **keywords/description are dynamically generated from database artists**: `localizedConcerts` extracts deduplicated `artist`, auto-updates as concerts are added or removed.
- `useHead` (only `import.meta.server`) injects **JSON-LD structured data** (WebSite + Person + ItemList + MusicEvent) + **hreflang** (3 languages + `x-default`, merged by the same key as `app.vue` to dedupe).
- JSON-LD uses `JSON.parse(JSON.stringify(toRaw(...)))` to strip Vue reactive Proxy, and uses `computed` to ensure the complete concert list is output after data is ready.

### 4.4 Homepage Floating Buttons: Background Music & universe Link

The bottom-right floating area of the homepage has two round buttons, both rendered in `app/pages/index.vue`:

- **Background music button**: Driven by `useMusic` (see 4.1); Font Awesome note icon; click toggles play/pause in a loop.
- **universe link button (cosmos / universe theme)**: Sits right next to the music button. It is a static external link `<a class="music-btn xy-btn" target="_blank" rel="noopener noreferrer" href="http://iliveworld.lyc.la">` that opens `http://iliveworld.lyc.la` in a new tab.
  - The icon is an **inline SVG** (`.xy-icon`, written inside `index.vue`): a gradient rounded-square background (horizontal purple→pink gradient `#C896B2 → #D993A7`, sampled from the design image) plus a white "planet + ring + small stars" graphic (matching the "universe / 宇宙" theme).
  - The hover tooltip text comes from the i18n key `tooltips.universe`, which must be maintained across all three languages (zh-CN / en / zh-Hant).
  - Base styles live in `public/css/main.css` under `.xy-btn` / `.xy-icon` (reusing the `.music-btn` round container and the hover pulse animation).

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
| `friend_links` | Friend links (`href` + `icon` + `title_i18n` + `description_i18n` + `seq` + `enabled`) |
| `site_settings` | Site settings (e.g. `site_url`, takes precedence over env vars) |
| `site_seo_i18n` | Site SEO multilingual (`site_title` / `site_description` / `site_keywords`, etc.) |
| `guestbook` | Guestbook messages (`nickname` + `email` + `content` + server-collected `browser`/`os`/`user_agent`/`ip` + `is_approved`) |
| `guestbook_reply` | Guestbook replies (`guestbook_id` FK cascade delete + `nickname` + optional `email` + `content` + server-collected fields + `is_approved`) |

All translatable fields are unified as **`*_i18n` JSON columns**, shaped like `{"zh-CN":"…","en":"…","zh-Hant":"…"}` (parsed by `parseI18n`; `zh-CN` is the base language, missing languages fall back at the UI layer; legacy `ja`/`ko` keys from old databases are not shown). `location` is split into four segments `country/province/city/venue` and reassembled per language as **`Country · Province · City · Venue`** during mapping (`mappers.ts`'s `joinLocation` / `mapLocationDetail`, empty segments auto-omitted, no cross-language fallback).

### 5.2 Initialization

```bash
npm run db:seed   # or npm run db:init (equivalent) — DROP then CREATE, resulting in an empty database
```

`seed.mjs` **DROP then CREATEs** (in foreign key dependency order), resulting in an empty database. Business data is imported externally (SQL / tools); the script itself does not populate data.

Schema changes treat `schema.sql` as the **single source of truth**: all historical one-off migrations (bilingual columns → `*_i18n`, the denormalized `likes` column, etc.) have been removed. Existing databases (local `data.db` / production Turso, requiring `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN` with **write access**) can be brought up to date for new tables (`guestbook` / `guestbook_reply` / `site_settings` / `site_seo_i18n` / `friend_links`, etc.) by simply running `schema.sql` — it uses `CREATE TABLE/INDEX IF NOT EXISTS` and is idempotent, so no migration script is needed.

---

## 6. Environment Variables

### 6.1 Configuration

| Variable | Description | Default |
|------|------|--------|
| `NUXT_TURSO_DATABASE_URL` | Database URL (`libsql:` remote or `file:` local) | `file:./public/data/data.db` |
| `NUXT_TURSO_AUTH_TOKEN` | Remote Turso auth token | Empty |
| `NUXT_TRUST_PROXY` | Whether to trust `X-Forwarded-For` (set `true` when behind a **self-hosted** reverse proxy / CDN; Vercel handles this automatically, no need to set it) | Empty (disabled) |
| `VERCEL` | Automatically injected by the Vercel platform (`=1`); used to detect the platform and prefer `x-vercel-forwarded-for` | Platform-injected |

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
npm run test       # Run unit tests (vitest run, 24 files / 334 cases)
npm run test:watch # Run tests in watch mode
npm run test:e2e   # Run end-to-end tests (Playwright, 6 suites; seeds the fixture DB and boots an isolated dev server)
```

---

## 8. API Reference

| Method | Path | Description |
|------|------|------|
| GET | `/api/data` | Single-endpoint aggregation: concerts (with `likes` / `liked`) + cities + wishes + stats + SEO + friend links; optional `?lang=<locale>` returns single-locale results and the response carries a `locale` field (= requested locale, or null) |
| GET | `/api/concerts/:id` | Single concert details (incl. tags/images/songlist and `likes` / `liked`), 400 for invalid id, 404 for not found |
| POST | `/api/like` | Like/unlike a concert (body `{ id }`, deduped by IP, togglable); returns `{ id, likes, liked }`; 400 / 404 on errors |
| GET | `/api/guestbook` | Paginated approved messages + their approved replies (`?page=` / `?pageSize=`, default 9, max 50) |
| POST | `/api/guestbook` | Post a message (body `{ nickname, email, content }`, auto-approved on submit); returns `{ id, ok }`; 400 on invalid/over-length fields, 429 when rate-limited |
| POST | `/api/guestbook/reply` | Post a reply (body `{ guestbookId, nickname, content, email? }`, email optional); 404 when the parent message is missing/unapproved |

> Like counts ride along with `/api/data` (no extra GET). To avoid leaking a per-IP `liked` flag through the shared
> cache, `/api/data` is split into a cached shared layer (counts included) plus a non-cached per-IP merge layer, and
> the response header is overridden to `private, no-store`; on a conditional request the inner layer returns
> `undefined` (Nitro already answered 304) and the outer layer returns early after a null check.
>
> **`POST /api/like` writes inside an interactive transaction** (`client.transaction('write')`, i.e. `BEGIN IMMEDIATE`):
> `DELETE → INSERT → recompute` has a read-modify-write dependency, so any failing statement rolls the whole thing back.
> The denormalized `concerts.likes` counter is **recomputed** via `UPDATE ... likes = (SELECT COUNT(*) ...)` (self-healing)
> instead of the old `±1` (which drifted permanently under concurrency); a pre-migration database without that column
> falls back to a live `COUNT(*)`, and **any other write failure is rethrown** (the frontend rolls back optimistically
> and shows a toast).

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

- `useSeoMeta`: Outputs title/description/og/twitter following language; keywords/description dynamically generated from database artists (3-language description templates in `app/utils/seo.ts`).
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
6. **Real client IP**: At runtime Vercel injects `VERCEL=1`, so `getClientIp()` prefers the platform-overwritten `x-vercel-forwarded-for` (single value, unspoofable). Like dedupe / rate limiting / guestbook IP capture therefore need **no** extra `NUXT_TRUST_PROXY` configuration.
7. Static asset compression: `nitro.compressPublicAssets: true` is enabled, so `public/**` assets are compressed automatically.

---

## 13. Notes

- `file:` local database relative paths are resolved based on `process.cwd()` (Nuxt root); do not run elsewhere to avoid database file location drift.
- `init-db.ts` uses `process.cwd() + 'server/db/schema.sql'` to locate the schema, because after Nitro compilation, `__dirname` points to the build output rather than the source tree.
- All `useState`/`useAsyncData` must be inside composable function bodies (lazy initialization), **module-level calls are prohibited**, otherwise SSR throws `instance unavailable`.
- **Environment variables must use the `NUXT_` prefix**; the `TURSO_` prefix may not be readable during config evaluation.
- **Remote Turso skips database creation in `init-db.ts`**, avoiding accidentally creating local empty database files.
- `concert_likes` now has an index `idx_concert_likes_ip` (speeds up per-IP like-set/count lookups). **Existing local databases** must manually run `CREATE INDEX IF NOT EXISTS idx_concert_likes_ip ON concert_likes(ip);` after the schema change (or rebuild via `npm run db:seed`, which is destructive) for it to take effect.
- **The guestbook has write endpoints**: `POST /api/guestbook` and `POST /api/guestbook/reply` write to the database (auto-approved on submit). In local `file:` mode the database file must be writable; on Turso it requires write access.
- The client `useData` now requests `/api/data?lang=<locale>` per current locale (key carries the locale for per-language caching). `localizedConcerts/Cities/Wishes` pass through when the server already localized, otherwise `localizeConcert` runs client-side; `counts` reads the server-precomputed `city.concertCount` in single-locale mode (no cross-locale recompute).
- After modifying `public/css/*` or `app/pages/index.vue`, no manual cache manifest maintenance is needed (Workbox runtime caching); PWA's `autoUpdate` handles updates automatically.
- **Statistic count-up animation**: `STAT_COUNTUP_DURATION` (5s) and `STAT_COUNTUP_REPEAT` (120s) live in `app/pages/index.vue`; the displayed value is derived lazily by `useCountUp`, so the **real number** is visible on first SSR paint and in no-JS scenarios (never 0).
- **`handleError` is safe from watch / event callbacks** (the error-copy resolver is registered during setup), but never call `useAppI18n()` / `useI18n()` directly inside a callback — it throws without a component instance.
- **`useTimeline`'s observer must be released explicitly**: a locale switch rebuilds the page component, and `onScopeDispose` takes care of `disconnect` on unmount. Add new observe logic through `initTimelineReveal()`; do not create another `IntersectionObserver`.
- **Known trade-off**: like counts in `/api/data` are still subject to the inner 1-hour shared cache and are not actively invalidated on write, so other visitors see the update only after the cache/SWR refresh (the current visitor's `liked` flag is unaffected — it is merged per request in the outer layer).
- **Token security**: `.env` is added to `.gitignore`. If a token was ever committed to git history, immediately **rotate to a new token** in the Turso dashboard.

---

## 14. Security: Client IP & Like Rate Limiting

Likes are deduplicated per IP (`UNIQUE(concert_id, ip)`) — one vote per user — and drive the "hot top 3". If the IP is spoofable, an attacker can like infinitely and poison the ranking.

### 14.1 Spoof-proof client IP

- **Never** trust the leftmost `X-Forwarded-For` entry unconditionally: `getRequestIP(event, { xForwardedFor: true })` reads the client-supplied leftmost XFF, which an attacker can forge — on a direct deploy they can impersonate arbitrary IPs and bypass dedup.
- All IP resolution now goes through `getClientIp(event)` (`server/lib/concertLikes.ts`), following a progressive trust chain:
  1. **Vercel (runtime auto-injects `VERCEL=1`)**: prefer `x-vercel-forwarded-for` (the platform-overwritten, **single unspoofable real client IP**), with XFF also trusted as a fallback;
  2. **Other reverse proxies / CDNs**: trust `X-Forwarded-For` only when `NUXT_TRUST_PROXY=true` is explicitly set;
  3. **Otherwise (default, including direct deploy)**: fall back to the TCP peer `socket.remoteAddress` — supplied by the OS, not forgeable by the client.
- **Direct deploy**: leave `NUXT_TRUST_PROXY` unset (off by default) → the IP is the socket address, inherently not spoofable.
- **Vercel deploy**: **no** need to set `NUXT_TRUST_PROXY` manually; at runtime `VERCEL=1` automatically enables the platform-provided real IP.
- **Self-hosted reverse proxy / CDN (Cloudflare, nginx, …)**: set `NUXT_TRUST_PROXY=true`. **Prerequisite**: the proxy must **overwrite** (not append to) `X-Forwarded-For` with the real client IP (e.g. nginx `proxy_set_header X-Forwarded-For $remote_addr;`). If it only appends, the leftmost entry may still carry a forged value.

### 14.2 Like rate limiting

- `server/lib/rateLimit.ts`: at most 10 requests per IP per 60s (`rateLimit(ip)`); on exceed returns `429` with `Retry-After` (seconds). Likes (`POST /api/like`) and the guestbook write endpoints (`POST /api/guestbook`, `POST /api/guestbook/reply`) share this limiter.
- Pure in-memory, zero-dependency, effective within a single process; empty buckets are pruned automatically (no memory leak).
- **Serverless caveat**: on Vercel / cloud functions each instance has its own memory and resets on cold start, so the limit applies only within a single instance and is not shared across instances. For global accuracy, use a shared store (e.g. Redis) and add another layer at the proxy / CDN (e.g. Cloudflare Rate Limiting).
- Thresholds are overridable at the call site: `rateLimit(ip, { windowMs, max })`.

### 14.3 User-Generated Content (Guestbook) · UGC safety

- **Store raw, escape on render**: message / reply content is stored as-is (no HTML escaping) and always rendered on the frontend via Vue text interpolation `{{ }}` (auto-escaped), **never `v-html`** — eliminating XSS at the root.
- **Server-collected**: besides nickname / content, browser, OS, UA and IP are all collected server-side, never trusted from the client (`server/lib/ua.ts` + `getClientIp`).
- **Email stored but never returned**: the `email` column of `guestbook` / `guestbook_reply` is not exposed by any read endpoint.
- **Length & format validation**: nickname ≤ 40 / content ≤ 1000 / email ≤ 120 and format-checked; write endpoints reuse the same rate limiter.
- **End-to-end regression**: `test/e2e/guestbook.spec.ts` asserts that script / event payloads are "rendered as plain text, not executed".


