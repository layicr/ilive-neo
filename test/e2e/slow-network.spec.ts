/**
 * E2E · 慢网（20 KB/s）与首屏关键路径 · Slow network & critical rendering path
 *
 * 覆盖点
 *  - CDP 限速 20 KB/s / 500ms RTT：遮罩随 SSR 内联关键 CSS 立即生效（不等外部 CDN 样式表）
 *  - 回归 P0-3：JS 水合成功前，遮罩不得被 15s CSS 兜底提前隐藏（修复前的真实缺陷）
 *  - 慢网下遮罩仍会淡出并露出首页，且不产生站点自身的未捕获异常
 *  - 回归 P0-2 / L3：字体与图标 CSS 不在 head；noscript 兜底必须用 <style> 包裹
 *
 * 说明：限速只作用于本 page 的网络栈，不影响 webServer / fixture 库；
 *       该 spec 仅由 chromium-desktop 收集（chromium-mobile 只匹配 mobile-responsive.spec.ts）。
 */
import { expect, test } from '@playwright/test'
import { collectErrors, siteErrors } from './helpers'

/** 20 KB/s 下行 ≈ 极慢 2G/3G 边界 · 20 KB/s downlink */
const DOWNLOAD_BYTES_PER_SEC = 20 * 1024

test.describe('慢网与首屏关键路径', () => {
  test('20 KB/s：遮罩立即生效、水合前不被提前隐藏、最终正常淡出', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 500,
      downloadThroughput: DOWNLOAD_BYTES_PER_SEC,
      uploadThroughput: 10 * 1024
    })
    const { pageErrors } = collectErrors(page)

    // commit 尽早返回；后续靠 DOM 状态而非 load 事件判断，避免慢网下 goto 超时
    await page.goto('/', { waitUntil: 'commit', timeout: 90_000 })
    await page.waitForSelector('#loader', { state: 'attached', timeout: 90_000 })

    // 书册关键 CSS 内联在 SSR HTML：遮罩应立即成为 fixed 全屏，不依赖任何外部 stylesheet
    await page.waitForFunction(
      () => {
        const el = document.getElementById('loader')
        return !!el && getComputedStyle(el).position === 'fixed'
      },
      null,
      { timeout: 30_000, polling: 100 }
    )

    // 在 20 KB/s 下持续观察约 8 秒：遮罩必须始终可见，不能被 15s CSS 兜底提前隐藏。
    // 此时 JS 尚未水合，html 上也不会出现 book-loader-armed（兜底未武装）。
    let hiddenBeforeHydration = false
    for (let i = 0; i < 40; i++) {
      const state = await page.evaluate(() => {
        const el = document.getElementById('loader')
        if (!el) return { gone: true as const }
        const cs = getComputedStyle(el)
        return {
          gone: false as const,
          hidden: cs.visibility === 'hidden' || cs.opacity === '0',
          hydrated: !!document.querySelector('.bk-cover.open')
        }
      }).catch(() => null)
      if (state?.gone || state?.hydrated) break
      if (state?.hidden) hiddenBeforeHydration = true
      await page.waitForTimeout(200)
    }
    expect(hiddenBeforeHydration, '遮罩在 JS 水合前被 15s CSS 兜底提前隐藏（P0-3 回归）').toBe(false)

    // dev server 会把 Vue 依赖拆成大量模块请求，全程 20 KB/s 时水合无法在用例超时内完成；
    // 首屏关键路径已验证完毕，恢复带宽后继续验证水合武装与淡出。
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    })

    await page.waitForFunction(
      () => document.documentElement.classList.contains('book-loader-armed'),
      null,
      { timeout: 60_000, polling: 100 }
    )
    await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 })
    expect(siteErrors(pageErrors), '慢网下出现站点自身的未捕获异常').toEqual([])
  })

  test('SSR head：外部字体/图标 CSS 不在渲染关键路径，noscript 兜底含 style 标签', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const head = html.slice(0, html.indexOf('</head>'))

    const blockingStylesheets = (head.match(/<link[^>]*rel="stylesheet"[^>]*>/g) ?? []).filter((tag) =>
      /fonts\.googleapis|font-awesome/.test(tag)
    )
    expect(blockingStylesheets, 'head 中仍有渲染阻塞的跨域样式表（P0-2 回归）').toEqual([])

    const noscripts = html.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/g) ?? []
    expect(
      noscripts.some((block) => /<style/i.test(block) && block.includes('bk-nojs-hide')),
      '无 JS 兜底缺少 <style> 包裹，CSS 会被当文本渲染而不生效（L3 回归）'
    ).toBe(true)
  })

  test('HTML 压缩语义：200 页 br 可解压、404 错误页不压缩、q=0 不压缩', async ({ request }) => {
    const ok = await request.get('/', { headers: { 'Accept-Encoding': 'br' } })
    expect(ok.status()).toBe(200)
    expect(ok.headers()['content-encoding']).toBe('br')
    expect(ok.headers()['vary']).toContain('Accept-Encoding')
    expect(await ok.text()).toContain('<html')

    // 回归：Nitro 错误渲染路径会把压缩后的 Buffer 当字符串重新按 UTF-8 编码，
    // 非法字节被替换成 U+FFFD → 客户端按 br 解压报 "Decompression failed"。
    // 404 页必须保持明文（Playwright 的 request 会自动解压，一旦回归此处直接抛错）。
    const missing = await request.get('/__compression_probe_404__', {
      headers: { 'Accept-Encoding': 'br' }
    })
    expect(missing.status()).toBe(404)
    expect(missing.headers()['content-encoding'] ?? '').not.toBe('br')
    expect(await missing.text()).toBeTruthy()

    const identity = await request.get('/', { headers: { 'Accept-Encoding': 'br;q=0' } })
    expect(identity.status()).toBe(200)
    expect(identity.headers()['content-encoding'] ?? '').not.toBe('br')
    expect(await identity.text()).toContain('<html')
  })
})
