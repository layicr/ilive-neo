# Concert Footprints (ilive_neo) Development Documentation

> Nuxt4 + Turso(LibSQL) Migration Version · Recording the emotion and memories of every concert
>
> [中文文档](./README_DEV.md) | English Version
>
> Last updated: **2026-11-07** — book-style loader, 20 KB/s slow-network first paint, SSR HTML compression, test suite & security review (sections 11 / 14).

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
- **First paint does not depend on external CDNs**: the book-style loader is SSR-emitted with inlined critical CSS, font / icon stylesheets are deferred to `bodyClose`, and dynamic SSR HTML is compressed by a Nitro plugin (see section 11).

---

## 2. Technology Stack

| Category | Technology |
|------|------|
| Framework | Nuxt 4 (`^4.5`), Vue 3 (`^3.5`), Vue Router 5 |
| Database | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt` (config-driven Service Worker, `/api/*` NetworkFirst) |
| Multilingual | `@nuxtjs/i18n` v10 (3 languages: zh / en / zh-Hant, `strategy: prefix_except_default`, default zh has no prefix) |
| Language | TypeScript (`strict` enabled, `typeCheck: false` at build time) |
| Animation | GSAP 3.12.2 (CDN, with SRI) |
| Styling | `public/css/main.css` (hand-written utilities; Google Fonts `@import` and the legacy spinner removed), Font Awesome 6.4.0 (CDN, loaded at `bodyClose`) |
| First paint | Full-screen book-style loader (SSR-emitted + inlined critical CSS), Nitro `render:response` dynamic HTML brotli / gzip compression, system font-stack fallback |
| SEO | Nuxt built-in `useSeoMeta` / `useHead` (multilingual hreflang / og:locale) + static `robots.txt` / `sitemap.xml` |
| Testing | Vitest (unit tests, happy-dom, **28 files / 401 cases**) + Playwright (E2E, **10 suites / 69 cases**, desktop / mobile projects + CDP 20 KB/s throttling + zero-download Edge mode) + `verify-seo.mjs` (SSR head validation script) |

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
├── nuxt.config.ts             # Nuxt master config (SSR/runtimeConfig/head/PWA/SEO; critical CSS / deferred bodyClose CSS / noscript fallback)
├── playwright.config.ts       # E2E config (two projects, fixture DB seed, PLAYWRIGHT_USE_EDGE zero-download mode)
├── app/                       # [Nuxt 4 srcDir] Application layer
│   ├── app.vue                # Root component (NuxtPage + global error handling + site-wide language SEO: html lang/canonical/hreflang/og:locale)
│   ├── pages/
│   │   └── index.vue          # Homepage "composition root": SEO / JSON-LD, init orchestration, body scroll lock + <SiteLoader /> as a sibling of the content (363 lines)
│   ├── components/            # Homepage blocks extracted from index.vue (18 components; each calls shared composables directly)
│   │   ├── AlbumShowcase.vue      # 3D album carousel (cover thumbnails + @error fallback)
│   │   ├── TicketModal.vue        # Ticket modal (@tanstack/vue-virtual row-based virtual scroll)
│   │   ├── CityModal.vue / GalleryModal.vue / VideoModal.vue / SonglistModal.vue
│   │   ├── HeroSection.vue / StoriesSection.vue / StatsCards.vue / TimelineSection.vue
│   │   ├── GuestbookSection.vue / WishWall.vue / SiteFooter.vue
│   │   ├── SiteLoader.vue        # Full-screen book-style loader (SSR-emitted #loader, inlined critical CSS, 15s failsafe armed only after hydration)
│   │   └── LanguageSwitcher.vue / MusicPlayer.vue / FeedbackButton.vue / BackToTopButton.vue
│   ├── composables/           # [Core] All interaction logic (Vue composables)
│   │   ├── useBookLoader.ts   # Book loader timing + poster prefetch (pure TS, fake-timer unit tests)
│   │   ├── useData.ts         # SSR requests /api/data?lang= per current locale (pass-through when server-localized, else localizeConcert) + like override; localized derivation is written to a request-scoped shared snapshot (app:localized), computed once
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
│       ├── index.ts           # Utility functions (safeHtml / time formatting / pickLocale / localize* / computeCityConcertCounts / firstSentence)
│       ├── thumb.ts           # Thumbnail helpers (thumbSrc: .jpg → _thumb.jpg; onThumbError: fall back to the full image)
│       └── seo.ts             # SEO pure functions (hreflang / og:locale / description templates / serializeJsonLd for XSS-safe JSON-LD)
├── i18n/                      # [Root] Locale messages (@nuxtjs/i18n v10 layout, langDir resolves relative to this dir)
│   └── locales/               # zh-CN.ts · en.ts · zh-Hant.ts (per-language messages, incl. loadingBook three-language loader copy)
├── public/                    # Static assets
│   ├── css/  main.css         # Global styles (Google Fonts @import and legacy spinner removed; first-paint critical CSS parses standalone)
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
│   │   ├── locales.ts         # Locale definitions (LOCALES)
│   │   └── htmlCompression.ts # Compression pure logic (encoding negotiation / should-compress / Vary & headers / error-render detection)
│   ├── plugins/
│   │   ├── init-db.ts         # Idempotent initialization on Nitro startup (skipped for remote Turso)
│   │   └── html-compression.ts # render:response dynamic SSR HTML br/gzip compression (skips error pages, env-switchable)
│   └── db/
│       ├── schema.sql         # Table structure (12 tables, translatable fields are *_i18n JSON columns)
│       └── seed.mjs           # Empty database creation script (DROP + CREATE, no business data)
├── scripts/                   # Build-time scripts
│   └── gen-thumbs.mjs         # Recursively generates 600px thumbnails under public/concert/ (_thumb.jpg, idempotent; npm run thumbs)
├── verify-seo.mjs · dump-head.mjs · html-head.mjs   # SSR head / SEO validation scripts (run directly via node)
├── test/                      # Tests
│   ├── unit/                  # Vitest unit tests (28 files / 401 cases; incl. useBookLoader / htmlCompression / serializeJsonLd / firstSentence)
│   ├── e2e/                   # Playwright end-to-end tests (10 suites / 69 cases, desktop/mobile projects + fixture DB seed)
│   │   ├── book-loader.spec.ts   # Loader copy / catalog / theme first sentence / fade-out / narrow viewport
│   │   └── slow-network.spec.ts  # CDP 20 KB/s throttling, critical path, noscript & HTML compression semantics
│   ├── ui-tests.md            # UI acceptance checklist (manual + automated; section 18 covers loader & slow network)
│   └── unit-tests.md / README.md
└── doc/
    ├── README_DEV.md          # This document (Chinese)
    └── README_DEV_EN.md       # This document (English)
```

---

## 4. Core Architecture & Data Flow

### 4.1 Frontend Bootstrap Chain (Vue-based)

No more classic script injectors. `app/pages/index.vue` has been slimmed from a monolith into a **composition root** (363 lines, was 1374): every presentation block lives in one of **18 components** under `app/components/`. Shared state comes from composables' `useState`, so **components call them directly — no props plumbing**:

```
app/pages/index.vue (composition root: coordination only)
  ├─ useData()             → useAsyncData('app-data') prefetches GET /api/data?lang=<locale> during SSR
  ├─ useSeoMeta()/useHead() → page-level title/description/og/twitter + SSR-only JSON-LD
  ├─ watch(currentLanguage) → update document.title + re-apply the album layout
  ├─ onMounted             → initBgMusic / initDataLayout (timeline reveal)
  ├─ watch([5 modal open flags]) → lock body scroll whenever any modal opens (must stay in the coordinator)
  ├─ <template>            → composes the 18 components + the static background circles
  └─ <SiteLoader />        → sibling of the content (avoids ancestor stacking contexts breaking position: fixed)

app/components/*.vue (each block owns its state & lifecycle)
  ├─ AlbumShowcase / TicketModal / CityModal / GalleryModal / VideoModal / SonglistModal
  ├─ HeroSection / StoriesSection / StatsCards / TimelineSection / GuestbookSection / WishWall
  └─ SiteFooter / SiteLoader / LanguageSwitcher / MusicPlayer / FeedbackButton / BackToTopButton
       each calls useData / useAlbumShowcase / useGallery / useTimeline / useGuestbook … as needed

app/app.vue (setup)
  └─ useHead + useI18n    → Site-wide language SEO: <html lang>, canonical, 3-language hreflang (incl. x-default),
                            og:locale / og:locale:alternate; language-independent static meta stays in nuxt.config.ts
```

Key points:

- **All `useState`/`useAsyncData` inside composables must be lazy-initialized** (called within the composable function body, never at module level), otherwise SSR throws `instance unavailable`.
- **Language switching does NOT re-request the API**: `localizedConcerts` and other computed values depend on `currentLanguage`; switching only recalculates frontend-derived values with zero network requests.
- `app/pages/index.vue` is now a **composition root**: it keeps only page-level SEO / JSON-LD, init orchestration and the body-scroll-lock. Interaction and presentation live in the 18 components under `app/components/`, each calling shared composables **directly** — do **not** pass `open` flags down as props (that creates reactive copies and desyncs from the coordinator's watchers).
- Site-wide language SEO (`<html lang>` / canonical / 3-language hreflang / `og:locale`) is emitted **once** by `app/app.vue` (it covers every page); `index.vue` no longer re-emits hreflang — its SSR `useHead` only outputs this page's own JSON-LD.
- **Localized derivation is shared per request (`app:localized` snapshot in `useData`)**: `localizedConcerts/Cities/Wishes/counts` are written into request-scoped shared state; the first `useData()` instance registers the sync `watch` once, so a locale switch computes **once** instead of "instances × N" times. ⚠️ The dedup flag must live on the **snapshot ref object** (not on `.value`) — if it is stored in a serialized `useState`, the client mis-reads it after hydration as "already registered", never registers the watch, and the localized snapshot stays empty (album area blank / page 500).
- **Statistic count-up (`app/composables/useCountUp.ts`)**: the displayed value is a `computed` — while not playing it **lazily passes through** the target. Never snapshot the target during setup: `useAsyncData` has not resolved yet at SSR time, so a snapshot yields 0, making the SSR HTML emit 0 and mismatching on hydration. After `onMounted` the next frame resets to 0 and plays (default 5s, easeOutCubic); pass `repeatMs` for periodic replay (120s on the homepage); `prefers-reduced-motion` skips the animation and shows the final value.
- **Context-safe error toasts (`app/composables/useAppError.ts`)**: vue-i18n's `useI18n()` **throws** `Must be called at the top of a 'setup' function` when there is no component instance. The error-copy resolver is therefore **registered during setup only** and reused afterwards, so `handleError(err, ctx, showUser=true, messageKey)` is safe from watch / event callbacks / global listeners — never resolve i18n directly inside a callback.
- **Timeline observer lifecycle (`app/composables/useTimeline.ts`)**: an `IntersectionObserver` holds **strong references** to observed nodes. It is disconnected and nulled when the owner unmounts (`onScopeDispose`), and every `initTimelineReveal()` disconnects before re-observing the current DOM — otherwise old DOM / image nodes survive a locale-switch page rebuild.
- **Book loader decoupled from first paint** (section 11): `SiteLoader.vue` is SSR-emitted as `#loader` with inlined critical CSS, so it needs neither hydration nor external CDN stylesheets; the 15s CSS failsafe is armed only after `onMounted` via `html.book-loader-armed`, so slow networks cannot hide the overlay prematurely.

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
- `useHead` (only `import.meta.server`) injects **JSON-LD structured data** (WebSite + Person + ItemList + MusicEvent). Note: hreflang / canonical / `og:locale` are emitted by `app/app.vue` and are **not repeated here** (the old implementation deduped two identical sources by key — pure redundancy).
- JSON-LD uses `JSON.parse(JSON.stringify(toRaw(...)))` to strip Vue reactive Proxy, and uses `computed` to ensure the complete concert list is output after data is ready.
- **XSS-safe JSON-LD serialization**: `innerHTML` always goes through `serializeJsonLd()` (`app/utils/seo.ts`), which writes `< > &` and U+2028 / U+2029 as JSON `\u` escapes — never a bare `JSON.stringify`. Concert names come from the DB; a script-closing tag in the data would terminate the ld+json block early and allow stored XSS in SSR output. unhead's current implicit escaping is **not** treated as a security boundary. Regressions: `test/unit/seo-utils.test.ts` and `test/e2e/security.spec.ts` (section 14.4).

### 4.4 Homepage Floating Buttons: Background Music & universe Link

The bottom-right floating area of the homepage has two round buttons, both rendered in `app/components/MusicPlayer.vue` (extracted from `index.vue`):

- **Background music button**: Driven by `useMusic` (see 4.1); Font Awesome note icon; click toggles play/pause in a loop.
- **universe link button (cosmos / universe theme)**: Sits right next to the music button. It is a static external link `<a class="music-btn xy-btn" target="_blank" rel="noopener noreferrer" href="http://iliveworld.lyc.la">` that opens `http://iliveworld.lyc.la` in a new tab.
  - The icon is an **inline SVG** (`.xy-icon`, written inside `MusicPlayer.vue`): a gradient rounded-square background (horizontal purple→pink gradient `#C896B2 → #D993A7`, sampled from the design image) plus a white "planet + ring + small stars" graphic (matching the "universe / 宇宙" theme).
  - ⚠️ The `<audio id="bgMusic">` / `<source id="bgMusicSource">` **ids must be kept**: `useMusic`'s `initBgMusic` and the locale-switch source swap both resolve the elements by id.
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
| `NUXT_DISABLE_HTML_COMPRESSION` | `=1` disables `server/plugins/html-compression.ts` SSR HTML compression (for deployments behind an already-compressing reverse proxy / CDN) | Empty (compression enabled) |
| `PLAYWRIGHT_USE_EDGE` | `=1` reuses the system Edge for E2E with zero browser downloads; also disables ffmpeg-dependent video / trace / failure screenshots | Empty (bundled Chromium) |
| `PLAYWRIGHT_DOWNLOAD_HOST` | Playwright browser download mirror (e.g. `https://cdn.npmmirror.com/binaries/playwright`) | Official CDN |
| `E2E_PORT` / `E2E_DB_FILE` | Isolated E2E dev server port / absolute fixture DB path (the real database stays read-only) | `3000` / `%TEMP%\ilive-e2e\e2e-data.db` |

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

### 6.4 Test Environment & Compression Switch

```powershell
# Zero-download E2E (reuse system Edge when Playwright browsers are not installed)
$env:PLAYWRIGHT_USE_EDGE = '1'
npm run test:e2e

# Install the minimal browser components from a domestic mirror
$env:PLAYWRIGHT_DOWNLOAD_HOST = 'https://cdn.npmmirror.com/binaries/playwright'
npx playwright install chromium-headless-shell ffmpeg

# Disable SSR HTML compression (when an upstream proxy / CDN already compresses)
$env:NUXT_DISABLE_HTML_COMPRESSION = '1'
```

> `NUXT_DISABLE_HTML_COMPRESSION` only affects dynamic SSR HTML; `nitro.compressPublicAssets` static compression is unaffected. E2E points `NUXT_TURSO_DATABASE_URL` at an isolated fixture DB — the real `public/data/data.db` is never written.

---

## 7. Development Commands

```bash
npm install        # Install dependencies (includes postinstall: nuxt prepare)
npm run dev        # Start development server (default http://localhost:3000/)
npm run build      # Production build (Nitro, deployable to Vercel)
npm run preview    # Preview production build
node .output/server/index.mjs  # Start the production build directly (use PORT, e.g. $env:PORT='3100')
npm run generate   # Generate static site (SSG)
npm run db:seed    # Initialize local empty database (DROP + CREATE, ⚠️ destructive)
npm run test       # Run unit tests (vitest run, 28 files / 401 cases)
npm run test:watch # Run tests in watch mode
npm run test:e2e   # Run end-to-end tests (Playwright, 10 suites / 69 cases; seeds the fixture DB and boots an isolated dev server)
npx playwright test --list     # List cases only, to verify suite / case counts
npm run thumbs     # Generate missing thumbnails under public/concert/ (_thumb.jpg, idempotent; run after adding images)
```

> ⚠️ Once `.output` accumulates hundreds of files, a rebuild's cleanup may trip the IDE bulk-delete guard; remove `.output` first (see `test/README.md` section 6).
> E2E and vitest **must not run in parallel in one batch**: `playwright.config.ts` runs serially (`workers: 1`), and parallel runs compete for the dev server / fixture DB.

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
> `DELETE → INSERT → ±1 counter update` has a read-modify-write dependency, so any failing statement rolls the whole thing back.
> The denormalized `concerts.likes` counter is an **independent historical baseline** (maintained manually, reflecting
> offline / historical totals — it is not required to equal the number of rows in `concert_likes`), so it is
> **incremented/decremented** via `UPDATE concerts SET likes = MAX(0, COALESCE(likes,0) + ?)` (+1 when liked, −1 when
> unliked, floored at 0). **Never recompute it from `(SELECT COUNT(*) …)`** — that resets a multi-thousand baseline down
> to the tiny real row count on any single click (showing up as "the like count suddenly jumps").
> A pre-migration database without that column falls back to a live `COUNT(*)`, and **any other write failure is rethrown**
> (the frontend rolls back optimistically and shows a toast).

---

## 9. SEO

### 9.1 Static Configuration (`nuxt.config.ts`)

- `SITE_URL = 'https://ilive.lyc.la'`, og:url / canonical / og:image / twitter:image unified as **https**.
- `app.head` keeps only **language-independent** static info: `author` / `robots` / `referrer` / `og:type` / `og:url` / `og:image` / `twitter:card` / `twitter:site` / `twitter:creator` / `twitter:image`, plus favicon / stylesheet / GSAP resource references.
- **Resource loading strategy (critical path)**: `<head>` keeps only `/css/main.css` as the critical stylesheet (`main.css` has no `@import`); Inter / Font Awesome stylesheets use `tagPosition: 'bodyClose'`, `fonts.googleapis.com` / `fonts.gstatic.com` keep `preconnect`, and fonts fall back to a system font stack with `display=swap`; GSAP keeps SRI. The `noscript` 15s overlay-hide rule **must wrap itself in `<style>`** (`innerHTML` is raw content, otherwise the CSS renders as text) — see section 11.
- The originally hard-coded Chinese `title` / `keywords` / `description` / `og:title` / `og:description` / `twitter:title` / `twitter:description` have all been **removed** (to avoid duplicating or conflicting with page-level `useSeoMeta`).
- Language-related meta: `og:locale` / `og:locale:alternate` are emitted by `app/app.vue`; `og:site_name` is emitted by page-level `useSeoMeta`.

### 9.2 Static Files

- `public/robots.txt`: Allows all crawlers, `Disallow: /api/`, references sitemap.
- `public/sitemap.xml`: Currently only the default-language homepage (`https://ilive.lyc.la/`, with one `zh-CN` `xhtml:link` alternate). 3-language hreflang is emitted **once** by `app/app.vue` in the page head (it covers every page) and does not depend on the sitemap.

### 9.3 Dynamic Meta Information (`app/pages/index.vue`)

- `useSeoMeta`: Outputs title/description/og/twitter following language; keywords/description dynamically generated from database artists (3-language description templates in `app/utils/seo.ts`).
- JSON-LD: WebSite + Person + ItemList + MusicEvent (per concert).
- hreflang / canonical: `zh-CN` / `en` / `zh-Hant` + `x-default` (default language `zh` href is `https://ilive.lyc.la/`, no `/zh` prefix) — emitted by `app/app.vue` only; pages do not repeat it.
- `<html lang>` and `og:locale` / `og:locale:alternate`: emitted uniformly by `app/app.vue` (`app/utils/seo.ts`'s `LOCALE_LANG` / `toOgLocale` / `buildHreflangLinks` / `toLocaleUrl` pure functions).

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

- **3D album covers** (`app/components/AlbumShowcase.vue`): the 3D carousel renders **all** covers at once, so they now use **600px thumbnails** (`thumbSrc()`: `xxx.jpg` → `xxx_thumb.jpg`) instead of full-resolution posters (188KB–1.4MB each); a missing thumbnail falls back to the full image via `@error`. The selected cover (first-screen LCP candidate) uses `loading="eager"` + `fetchpriority="high"`; the rest use `loading="lazy"` + `fetchpriority="low"`; all keep `decoding="async"`.
- **Gallery thumbnails**: `loading="lazy"` + `decoding="async"`; `.gallery-item` has fixed `width/height` (120×80, 100×67 on mobile) to prevent CLS.
- **Ticket poster** (`app/components/TicketModal.vue`): an `<img class="ticket-poster">` plus a thumbnail (same `thumbSrc()`, falling back via `@error` when missing); `loading="lazy"` is **not** used — the virtual scroller already bounds the DOM, and lazy-loading can fail to trigger under the `.ticket-modal` `display:none` → open toggle (images judged off-screen). `decoding="async"` is kept.
- **Thumbnail generation** (companion to `app/utils/thumb.ts`): `scripts/gen-thumbs.mjs` (`npm run thumbs`) walks **every subdirectory** of `public/concert/` (poster + each `<date>` gallery) and generates 600px / q72 `_thumb` variants for originals that lack one; it is **idempotent** (existing variants are skipped), so newly added images are covered by one command. The `thumbSrc()` naming convention (`_thumb.jpg`) must stay in sync with the script.

> Optional follow-ups (asset-level rework, not yet implemented): transcode jpgs to **WebP/AVIF** and use `<picture>` + `srcset` for resolution adaptation; or adopt `@nuxt/image` to unify responsive images and transcoding. Benefits depend on the build/deploy pipeline; larger change, evaluate on demand.

### 10.2 Ticket Virtual Scroll

The ticket modal originally rendered all cards at once in a multi-column Grid, so DOM and image cost grew with the dataset. It now uses row-windowed rendering via `@tanstack/vue-virtual`: only the card rows near the viewport (plus `overscan`) are rendered, preserving the multi-column grid look.

- **`count` must be a number, AND the whole options object must be wrapped in a `computed`** (both traps matter):
  1. Passing a **function** as `count` (e.g. `() => rowCount.value`) makes the library do `new Array(count)` / `count - 1` on it, yielding `NaN` and throwing `RangeError: Invalid array length`, blanking the whole list.
  2. But writing merely `count: rowCount.value` while passing a **plain object** fails too: the library is implemented as `computed(() => ({ ...defaults, ...unref(options) }))`, so a plain object is evaluated **during setup** and `count` is frozen at that static number — later `rowCount` changes never trigger `setOptions`. A locale switch rebuilds the page component and the new locale's data only arrives *after* setup, so `count` latches onto 0 forever — showing up as "**the ticket modal is empty after switching language**".
  - Correct usage: `useVirtualizer(computed(() => ({ count: rowCount.value, getScrollElement: …, estimateSize: …, overscan, gap })))` — `count` stays a **number**; reactivity comes from the outer `computed` (the signature is `MaybeRef<Options>`, so a `Ref` is accepted).
- **Dynamic row measurement**: card height varies with content (~660–720px); a fixed `estimateSize` causes row overlap. `measureElement` + `:data-index` and `:ref="setTicketRowRef"` on each row let the virtualizer read the real row height; `estimateSize` is only a first-paint estimate.
- **Fixed row gap**: the `gap` option (`ROW_GAP`) inserts a uniform gap between rows, more reliable than just inflating `estimateSize`, eliminating overlap.
- **`useVirtualizer` returns a `shallowRef`**: access instance methods in `<script>` via `virtualizer.value?.<method>()` (templates auto-unwrap, so `virtualizer.getVirtualItems()` works directly); when the modal opens the container grows from zero size, so in the `watch(ticketModalOpen)` `nextTick` run `computeColumns()` / `computeRowHeight()` and `virtualizer.value.measure()` to recompute.

---

## 11. Book Loader, Critical Path & Slow Networks (2026-11-07)

> Background: under slow-network measurements the homepage SSR HTML was ~248 KB (Nuxt payload ~121 KB) and cross-origin font / icon CSS blocked parsing serially, so the book cover took over ten seconds to paint. The old 15s CSS failsafe also started counting from "page load began", hiding the overlay before JS hydration. This round shipped the three P0 changes as a minimal change set and locked them down with 20 KB/s automated regressions.

### 11.1 Book loader (SiteLoader)

- `app/components/SiteLoader.vue`: the legacy spinner became a full-screen book (cover / left catalog / right concert details / bottom progress bar), two-page desktop layout and a single-page narrow-viewport layout; no buttons or skip hints, `aria-busy="true"`, and `:data-finish` reporting `ready | timeout | error`.
- `#loader` is SSR-emitted with **inlined critical CSS** (no hydration, no external CDN); `<SiteLoader />` sits alongside the homepage content so no ancestor stacking context can break `position: fixed`.
- All data comes from `/api/data`: catalog rows / years and right-page concert details; the quote is the **first sentence** of the current-locale `theme` (`firstSentence()` in `app/utils/index.ts` — take the first paragraph, then split on CJK / English sentence punctuation); posters use `_thumb.jpg` via `thumbSrc()`. Three-language copy lives in `loadingBook` inside `i18n/locales/*.ts` (`tocFoot` and the static `quotes` were removed).
- Timing and prefetch live in `app/composables/useBookLoader.ts` (pure TS + fake-timer unit tests):

| Constant | Value | Purpose |
|------|------|------|
| `BOOK_COVER_MS` | 900 ms | Cover dwell |
| `BOOK_WINDOW_MS` | 12.6 s | Page-turn window, quadratic easing `G_MAX 1.32s → G_MIN 0.32s` |
| `BOOK_MIN_SHOW_MS` | 2.4 s | Minimum perceptible window; SSR-ready data must not fade instantly |
| `BOOK_MAX_MS` | 13.5 s | Hard cap, forces `timeout` fade-out |
| `BOOK_FADE_MS` | 900 ms | Fade then remove the overlay, total < 15 s |

`setReady()` finishes with `ready` after the minimum window, `setFailed()` finishes with `error` immediately, and reaching the end of the book without data ends with `timeout`. `createPosterPrefetcher()` deduplicates, warms the current / next page with `warmAround()`, and fills the rest at low priority via `requestIdleCallback`.

> ⚠️ `clearAll()` uses `timers.forEach(...)` instead of `for...of` over a `Set`: the latter needs `downlevelIteration` under a low TS target and breaks the build.

### 11.2 Critical path (P0)

1. **Move external CSS off the critical path**: removed the first-line Google Fonts `@import` and the legacy `.loader/.spinner` from `main.css`; `nuxt.config.ts` defers Inter / Font Awesome stylesheets with `tagPosition: 'bodyClose'`, keeps `preconnect` and `display=swap` + a system font stack. `<head>` keeps only `/css/main.css`, so the overlay paints immediately from inlined SSR CSS even at 20 KB/s.
2. **Fix the 15s CSS failsafe start**: `:global(html.book-loader-armed) .bk-loader { animation: bk-failsafe 0s linear 15s forwards }` — the class is added only in `onMounted` (after hydration) and removed on `finish` / unmount; no-JS users are covered by the `noscript > <style>` rule in `nuxt.config.ts`.
3. **SSR HTML compression**: see 11.3.

> Do not even write the literal `@import` in comments: a static check once mis-detected it as a real import declaration.

### 11.3 SSR HTML compression (`server/plugins/html-compression.ts`)

- `nitro.compressPublicAssets` only covers `public/**`; dynamic SSR HTML was still plain text. The plugin negotiates `Accept-Encoding` in `render:response` and compresses with brotli (preferred, quality 5) / gzip (level 6) **asynchronously**; measured homepage: ~248 KB → **47 KB (br) / 63 KB (gzip)**.
- Pure logic lives in `server/lib/htmlCompression.ts` (`negotiateEncoding` / `shouldCompress` / `mergeVary` / `resolveStatusCode` / `isNuxtErrorRender` / case-insensitive header helpers), covered by 19 cases in `test/unit/htmlCompression.test.ts`.
- Cache / negotiation semantics: every HTML response declares `Vary: Accept-Encoding`; q-values, `q=0` and `*` are parsed, br wins; only `200 + text/html + string body + ≥ 1 KB + not already encoded`; compressed responses drop `ETag` / `Last-Modified` / `Content-Length` so a CDN cannot reuse a br representation for gzip-only clients. `NUXT_DISABLE_HTML_COMPRESSION=1` turns it off.
- ⚠️ **404 / 500 error pages must never be compressed**: Nuxt renders them through the internal `/__nuxt_error?...&statusCode=404` route, where both `response.statusCode` and `event.node.res.statusCode` are **still 200** at `render:response`; the error render path additionally re-encodes the compressed `Buffer` as a UTF-8 string (invalid bytes become U+FFFD), producing `failed to decompress 'br' encoding` on the client. `isNuxtErrorRender()` skips these pages, leaving them uncompressed.

### 11.4 20 KB/s regressions & test isolation

- `test/e2e/slow-network.spec.ts`: CDP `Network.emulateNetworkConditions` simulates **20 KB/s down / 500 ms RTT** and asserts the overlay is immediately fixed / full-screen, is not hidden by the 15s failsafe before hydration, and fades normally after bandwidth is restored; it also checks that `<head>` has no blocking external CSS, `noscript` contains `<style>`, and compression semantics (200 br decodable / 404 plain / `q=0` uncompressed).
- The dev server splits Vue dependencies into many module requests; full-time throttling cannot hydrate within the 120 s case timeout → **only the first-paint phase is throttled (~8 s)**, then bandwidth is restored for the hydration / fade-out checks.
- `test/e2e/book-loader.spec.ts` (6 cases) covers three-language copy, catalog rows / years, theme first sentence, no buttons, progress bar, fade-out and the narrow-viewport single-page layout.
- Write isolation: E2E specs share a fixture DB serially. The like rate-limit case now uses a **nonexistent concert id** (the limiter runs before existence validation, so 429 still triggers with zero DB writes), and `ui-structure.spec.ts` reads the current like count from `/api/data` as a dynamic baseline — no order-dependent false failures.

---

## 12. Deployment (Vercel)

1. Configure `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN` in Vercel dashboard.
2. Bind domain `ilive.lyc.la` (Vercel automatically provides HTTPS SSL).
3. Push code, Vercel executes `nuxt build` to generate Nitro serverless output.
4. `public/robots.txt` / `sitemap.xml` will be packaged as static files by Nitro.
5. After first deployment, visit `/api/data` to confirm remote Turso data is returned.
6. **Real client IP**: At runtime Vercel injects `VERCEL=1`, so `getClientIp()` prefers the platform-overwritten `x-vercel-forwarded-for` (single value, unspoofable). Like dedupe / rate limiting / guestbook IP capture therefore need **no** extra `NUXT_TRUST_PROXY` configuration.
7. **Compression**: `nitro.compressPublicAssets: true` compresses `public/**` static assets; dynamic SSR HTML is compressed by `server/plugins/html-compression.ts` with br / gzip based on `Accept-Encoding` (~248 KB → 47 KB) and a uniform `Vary: Accept-Encoding`. If Vercel / a CDN already compresses HTML, set `NUXT_DISABLE_HTML_COMPRESSION=1` to avoid double compression; 404 / 500 error pages stay plain text (see 11.3).

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
- **Statistic count-up animation**: `STAT_COUNTUP_DURATION` (5s) and `STAT_COUNTUP_REPEAT` (120s) live in `app/components/StatsCards.vue` (extracted from `index.vue`); the displayed value is derived lazily by `useCountUp`, so the **real number** is visible on first SSR paint and in no-JS scenarios (never 0). The three `useCountUp` calls must **stay in place** in that component (they own SSR pass-through and timer lifecycle).
- **`handleError` is safe from watch / event callbacks** (the error-copy resolver is registered during setup), but never call `useAppI18n()` / `useI18n()` directly inside a callback — it throws without a component instance.
- **`useTimeline`'s observer must be released explicitly**: a locale switch rebuilds the page component, and `onScopeDispose` takes care of `disconnect` on unmount. Add new observe logic through `initTimelineReveal()`; do not create another `IntersectionObserver`.
- **Known trade-off**: like counts in `/api/data` are still subject to the inner 1-hour shared cache and are not actively invalidated on write, so other visitors see the update only after the cache/SWR refresh (the current visitor's `liked` flag is unaffected — it is merged per request in the outer layer).
- **Token security**: `.env` is added to `.gitignore`. If a token was ever committed to git history, immediately **rotate to a new token** in the Turso dashboard.
- **Book loader 15s failsafe**: the CSS animation is gated by `html.book-loader-armed`, which only `SiteLoader.vue`'s `onMounted` (successful hydration) may add; `finish` / unmount must remove it — otherwise the timer starts at page load and hides the overlay before hydration on slow networks. The no-JS fallback rule must wrap itself in `<style>` (see 11.2).
- **Compression plugin must not hand binary data to the error render path**: when changing `render:response` or adding HTML responses, `shouldCompress()` must check both the status code and `isNuxtErrorRender(event.path)`; a compressed error page becomes an undecodable br response (see 11.3).
- **E2E write state**: the fixture DB is shared serially across specs; cases that write should use nonexistent targets / relative assertions or roll back, and static structure assertions should read a dynamic baseline — no order-dependent false failures.
- **Report artifacts**: once `test/report/e2e-artifacts` / `e2e-html` accumulate hundreds of files, Playwright's startup cleanup may trip the IDE bulk-delete guard; delete both directories before rerunning (see `test/README.md` section 6).

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

### 14.4 Read-only security review (2026-11-07) · Security review

**Fixed / hardened in this round**: H2 (JSON-LD now uses `serializeJsonLd()` — explicit `\u` escapes for `< > &` and U+2028 / U+2029 instead of relying on unhead's implicit escaping; see 4.3), H3 (shared ETag / missing uniform `Vary` in SSR compression → cross-encoding CDN cache poisoning), M6 (compression type contract, q-values, synchronous blocking, status-code boundaries and corrupted br on 404), L3 (bare CSS in `noscript` not wrapped in `<style>`). Implementation & regressions: 11.3, `test/unit/htmlCompression.test.ts`, `test/unit/seo-utils.test.ts`, `test/e2e/slow-network.spec.ts`, `test/e2e/security.spec.ts`.
