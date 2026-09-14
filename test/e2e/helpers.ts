/**
 * E2E 公共辅助 · Shared E2E helpers
 *
 * @description 统一「进入首页 → 等待客户端 hydration 完成 → loader 收起」的入口，并提供 console/pageerror
 *              采集、第三方噪声过滤、横向溢出检测等跨 spec 复用的断言工具，避免每个 spec 各写一套。
 *
 *              重要（本阶段修正）：站点为 Nuxt SSR + 客户端 hydration。dev 模式下 `page.goto` 返回时
 *              DOM 已由 SSR 直出，但 Vue 事件尚未绑定；此时点击不会触发任何交互，用例会表现为
 *              「click timeout」或「class 不变化」。因此 `waitAppReady` 显式等待 `#__nuxt.__vue_app__`
 *              挂载后再放行，这是本轮多数失败的根因修复点。
 */
import { expect, type Page } from '@playwright/test'

/** 站点支持的语言及其预期 SSR 文案 · locales and their expected SSR copy */
export const LOCALES = {
  'zh-CN': { path: '/', lang: 'zh-CN', title: 'Layicr演唱会足迹' },
  en: { path: '/en', lang: 'en', title: 'Layicr Concert Journey' },
  'zh-Hant': { path: '/zh-Hant', lang: 'zh-Hant', title: 'Layicr演唱會足跡' }
} as const

/** 站点正式域名（来自 DB site_settings.site_url） · canonical / hreflang 的基准 */
export const SITE_ORIGIN = 'https://ilive.lyc.la'

/** 判断 URL 是否属于被测站点（用于把第三方资源的噪声排除在断言之外） · is same-origin under test */
export function isSameOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)
}

/** 打开首页并等待客户端可用 · open the home page and wait until the client is interactive */
export async function gotoHome(page: Page, path = '/'): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await waitAppReady(page)
}

/**
 * 等待客户端 hydration 完成并收起 loader · wait for hydration and loader dismissal
 *
 * dev 模式首次编译 + hydration 可能耗时数十秒，故超时放宽到 90s；hydration 完成后交互才真实可用。
 */
export async function waitAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
      return !!root && !!root.__vue_app__
    },
    null,
    { timeout: 90_000 }
  )
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 })
  // 移除 Nuxt DevTools 浮层：其常驻 frame / 悬浮球位于页面右下角，会拦截 tap 的 actionability 判定，
  // 造成“被 nuxt-devtools-frame 拦截指针事件”的假失败；该浮层仅 dev 环境存在，移除不影响被测逻辑。
  await page.evaluate(() => {
    document.getElementById('nuxt-devtools-container')?.remove()
  })
}

/** 采集控制台错误与未捕获异常（含来源 URL，便于过滤第三方噪声）· collect console errors and uncaught errors */
export function collectErrors(page: Page): { consoleErrors: string[]; pageErrors: string[] } {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const url = msg.location()?.url ?? ''
    consoleErrors.push(url ? `${msg.text()} @ ${url}` : msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  return { consoleErrors, pageErrors }
}

/**
 * 过滤与本页无关的噪声，只保留「站点自身」的控制台错误 · keep only first-party console errors
 *
 * 排除：第三方资源失败（统计脚本 403 等）、浏览器 autoplay 策略拒绝、被中断的音频请求、favicon。
 */
export function siteErrors(list: string[]): string[] {
  const NOISE =
    /autoplay|play\(\) failed|AbortError|ERR_ABORTED|favicon|sdk\.51\.la|hm\.baidu|google-analytics|googletagmanager/i
  return list.filter((entry) => {
    if (NOISE.test(entry)) return false
    const at = entry.lastIndexOf(' @ ')
    const url = at >= 0 ? entry.slice(at + 3) : ''
    if (url && !isSameOrigin(url)) return false
    return true
  })
}

/** 断言无横向溢出（移动端关键回归项）· assert no horizontal overflow */
export async function expectNoHorizontalOverflow(page: Page, label = ''): Promise<void> {
  const size = await page.evaluate(() => {
    const vw = window.innerWidth
    const offenders: string[] = []
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect()
      const over = r.right - vw
      if (over > 0.5) {
        const cls = String(el.className || '').split(' ')[0]
        offenders.push(
          `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}(over=${Math.round(over)},w=${Math.round(r.width)})`
        )
      }
    })
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: vw,
      offenders: offenders.slice(0, 6)
    }
  })
  expect(
    size.scrollWidth - size.innerWidth,
    `${label} 出现横向溢出：scrollWidth=${size.scrollWidth} > innerWidth=${size.innerWidth}；` +
      `超出视口的元素示例：${size.offenders.join(' | ') || '（无元素超出视口，可能由根元素宽度引起）'}`
  ).toBeLessThanOrEqual(2)
}

/** 读取 SSR/CSR 渲染后的 head 元信息 · read rendered head meta */
export async function readHead(page: Page) {
  return page.evaluate(() => {
    const attr = (sel: string, name: string) =>
      document.querySelector(sel)?.getAttribute(name) ?? null
    return {
      htmlLang: document.documentElement.getAttribute('lang'),
      title: document.title,
      canonical: attr('link[rel="canonical"]', 'href'),
      description: attr('meta[name="description"]', 'content'),
      ogLocale: attr('meta[property="og:locale"]', 'content'),
      hreflangs: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(
        (el) => ({ hreflang: el.getAttribute('hreflang'), href: el.getAttribute('href') })
      )
    }
  })
}
