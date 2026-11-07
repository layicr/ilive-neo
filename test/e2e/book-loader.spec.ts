/**
 * E2E · 书册加载页 · Book-style loader
 *
 * 覆盖点
 *  - 三语文案（zh-CN / en / zh-Hant）、目录行数与日期带年份、tocFoot 已移除
 *  - 纯自动：无任何按钮，保留进度条
 *  - 每页引文取自该场演唱会主题的第一句话
 *  - 数据就绪即淡出，遮罩移除后首页面可见
 *  - 窄视口下左页目录隐藏、迷你目录显示（移动端单页书册）
 *
 * 说明：fixture 库只有 4 场演唱会，目录行数以 /api/data 的实际数量为准，不硬编码 19。
 */
import { expect, test } from '@playwright/test'
import { gotoHome } from './helpers'

/** 各语言目录品牌尾巴（与 i18n/locales/*.ts 的 loadingBook.brandTail 对应） */
const BRAND_TAIL: Record<string, string> = {
  '/': '演唱会足迹',
  '/en': 'Live Archive',
  '/zh-Hant': '演唱會足跡'
}

test.describe('书册加载页 · 三语与结构', () => {
  for (const [path, tail] of Object.entries(BRAND_TAIL)) {
    test(`${path} 文案、目录与进度条正确`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'commit' })
      await page.waitForSelector('#loader', { state: 'attached' })

      // text-transform: uppercase 会影响 innerText，故用大小写不敏感比较
      expect((await page.locator('.bk-brand-mini').innerText()).toLowerCase()).toContain(
        tail.toLowerCase()
      )
      expect(await page.locator('#loader button').count(), '加载页不应有可跳过/控制按钮').toBe(0)
      expect(await page.locator('.bk-lb-track').count(), '进度条应保留').toBe(1)
      expect(await page.locator('.bk-toc-foot').count(), 'tocFoot 已移除').toBe(0)

      const api = await (await page.request.get('/api/data?lang=zh-CN')).json()
      const concertCount = api.data.concerts.length
      expect(await page.locator('.bk-toc-row').count(), '目录应列出全部演唱会').toBe(concertCount)
      expect(await page.locator('.bk-toc-row .bk-d').first().innerText(), '目录日期需带年份').toMatch(/\d{4}/)
    })
  }

  test('每页引文是当前语言主题的第一句话', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForSelector('.bk-quote')

    const quote = (await page.locator('.bk-quote').innerText())
      .replace(/^「\s*/, '')
      .replace(/\s*」$/, '')
      .trim()
    expect(quote.length, '引文不应为空').toBeGreaterThan(0)
    expect(quote, '引文不应跨段').not.toContain('\n')

    const api = await (await page.request.get('/api/data?lang=zh-CN')).json()
    const themes: string[] = api.data.concerts
      .map((c: { theme?: string }) => c.theme ?? '')
      .filter(Boolean)
    const source = themes.find((theme) => theme.startsWith(quote))
    expect(source, '引文必须来自某场演唱会主题原文').toBeTruthy()

    // 与 app/utils/index.ts 的 firstSentence 同规则：先取首段，再停在第一个句末标点；
    // fixture 里的短主题可能本身没有标点，此时整段即「第一句」。
    const paragraph = (source ?? '').trim().split(/\r?\n+/)[0] ?? ''
    const end = /[。！？!?]|\.(?=\s|$|[\u3400-\u9FFF]|[A-Z])/.exec(paragraph)
    if (end) {
      expect(quote, '引文应停在主题的第一句').toBe(
        paragraph.slice(0, end.index + end[0].length).trim()
      )
    }
  })

  test('数据就绪后遮罩移除，首页面可见', async ({ page }) => {
    await gotoHome(page, '/')
    expect(await page.locator('#loader').count(), '淡出后遮罩应从 DOM 移除').toBe(0)
    await expect(page.locator('#site-name')).toBeVisible()
    await expect(page.locator('#timeline')).toBeVisible()
  })

  test('窄视口切换为单页书册：左页隐藏、迷你目录显示', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForSelector('#loader', { state: 'attached' })

    const leftDisplay = await page.locator('.bk-page-left').evaluate((el) => getComputedStyle(el).display)
    expect(leftDisplay, '移动端应隐藏双页目录').toBe('none')

    await page.waitForSelector('.bk-mini-toc')
    const miniDisplay = await page.locator('.bk-mini-toc').first().evaluate((el) => getComputedStyle(el).display)
    expect(miniDisplay, '移动端应显示迷你目录').not.toBe('none')
  })
})
