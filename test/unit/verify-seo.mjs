const BASE = 'http://localhost:3000'
const BASE2 = 'http://localhost:3001'
// 站点语言：zh-CN（默认无前缀）/ en / zh-Hant（与 server/lib/locales.ts 一致）
// Site locales: zh-CN (default, no prefix) / en / zh-Hant (same as server/lib/locales.ts)
const paths = ['/', '/en', '/zh-Hant']

async function check(base) {
  for (const p of paths) {
    const url = base + p
    try {
      const r = await fetch(url)
      const t = await r.text()
      const lang = (t.match(/<html[^>]*lang="([^"]*)"/i) || [])[1] || '(none)'
      const title = (t.match(/<title>([^<]*)<\/title>/i) || [])[1] || '(none)'
      const ogLocale = (t.match(/<meta[^>]*property="og:locale"[^>]*content="([^"]*)"/i) || [])[1] || '(none)'
      const hreflangs = [...t.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]*)"/gi)].map(m => m[1])
      console.log(`${p.padEnd(10)} status=${r.status} lang=${lang}`)
      console.log(`           title=${title}`)
      console.log(`           og:locale=${ogLocale}`)
      console.log(`           hreflang=[${hreflangs.join(', ')}]`)
    } catch (e) {
      console.log(`${p.padEnd(10)} ERROR ${e.message}`)
    }
  }
}

console.log('=== trying :3000 ===')
await check(BASE)
console.log('\n=== trying :3001 ===')
await check(BASE2)
