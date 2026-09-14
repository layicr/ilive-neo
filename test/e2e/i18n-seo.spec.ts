/**
 * E2E · SEO meta 实渲染 + i18n 语言前缀路由 · SEO meta rendering & i18n prefixed routing
 *
 * 覆盖点
 *  - SEO meta 实渲染：<title> / meta description / canonical / hreflang / og:locale / html lang
 *  - 语言前缀路由：/（zh-CN 无前缀）、/en、/zh-Hant 三语 SSR 直出校验（prefix_except_default）
 *  - 语言切换交互：点击语言菜单后 URL 落到前缀路由、标题与页面文案随之切换
 *  - 站点地图/robots 可达性（SEO 基础件）
 */
import { expect, test } from '@playwright/test'
import { gotoHome, LOCALES, readHead, SITE_ORIGIN } from './helpers'

test.describe('SEO meta 实渲染', () => {
  test('zh-CN 根路径：title/description/canonical/hreflang/og:locale 均真实落到 DOM', async ({
    page
  }) => {
    await gotoHome(page, '/')
    const head = await readHead(page)

    expect(head.htmlLang).toBe('zh-CN')
    expect(head.title).toBe(LOCALES['zh-CN'].title)
    expect(head.description).toBeTruthy()
    expect(head.canonical).toBe(`${SITE_ORIGIN}/`)
    expect(head.ogLocale?.replace('-', '_')).toBe('zh_CN')

    // hreflang：3 语言 + x-default
    const langs = head.hreflangs.map((h) => h.hreflang)
    expect(langs).toEqual(expect.arrayContaining(['zh-CN', 'en', 'zh-Hant', 'x-default']))
    const en = head.hreflangs.find((h) => h.hreflang === 'en')
    expect(en?.href).toBe(`${SITE_ORIGIN}/en`)
    const hant = head.hreflangs.find((h) => h.hreflang === 'zh-Hant')
    expect(hant?.href).toBe(`${SITE_ORIGIN}/zh-Hant`)
  })

  test('/en 前缀路由：html lang、title、canonical 全部切换为英文', async ({ page }) => {
    await gotoHome(page, '/en')
    const head = await readHead(page)

    expect(head.htmlLang).toBe('en')
    expect(head.title).toBe(LOCALES.en.title)
    expect(head.canonical).toBe(`${SITE_ORIGIN}/en`)
  })

  test('/zh-Hant 前缀路由：繁体标题与 canonical 正确', async ({ page }) => {
    await gotoHome(page, '/zh-Hant')
    const head = await readHead(page)

    expect(head.htmlLang).toBe('zh-Hant')
    expect(head.title).toBe(LOCALES['zh-Hant'].title)
    expect(head.canonical).toBe(`${SITE_ORIGIN}/zh-Hant`)
  })

  test('robots.txt 与 sitemap.xml 可访问且指向站点域名', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain('Sitemap')

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain('<urlset')
    expect(xml).toContain('ilive.lyc.la')
  })
})

test.describe('i18n 语言切换与语言前缀路由', () => {
  test('zh 无前缀根路径可直达，且不响应 /zh-CN 前缀（404）', async ({ page, request }) => {
    const res = await request.get('/zh-CN')
    expect(res.status(), 'zh-CN 为默认语言，不应存在 /zh-CN 前缀路由').toBe(404)

    await gotoHome(page, '/')
    await expect(page.locator('#site-name')).toBeVisible()
  })

  test('语言切换交互：切换到 English 后 URL / 标题 / 文案同步', async ({ page }) => {
    await gotoHome(page, '/')
    const before = await page.title()

    await page.locator('.lang-trigger').click()
    await expect(page.locator('.lang-menu')).toBeVisible()
    await page.locator('.lang-option[data-lang="en"]').click()

    await expect(page).toHaveURL(/\/en\/?$/)
    await expect.poll(async () => page.title(), { timeout: 10_000 }).not.toBe(before)
    // 客户端切换语言后的标题必须与 SSR 直出同源（index.vue: currentPageTitle —— DB site_title 优先），
    // 而不是被覆写为静态 i18n pageTitle；此断言用于固化该契约（该覆写问题已修复）。
    await expect.poll(async () => page.title(), { timeout: 10_000 }).toBe(LOCALES.en.title)
    expect(await page.title(), '英文页面标题不应包含中文').not.toMatch(/[\u4e00-\u9fff]/)

    const head = await readHead(page)
    expect(head.canonical).toBe(`${SITE_ORIGIN}/en`)
  })

  test('语言切换可回退到 zh-Hant 且 hreflang 随之保持完整', async ({ page }) => {
    await gotoHome(page, '/')
    await page.locator('.lang-trigger').click()
    await page.locator('.lang-option[data-lang="zh-Hant"]').click()

    await expect(page).toHaveURL(/\/zh-Hant\/?$/)
    // 语言切换是客户端逻辑（store 文案更新後に title 生效），存在毫秒级过渡：
    // 直接取样会拿到过渡中的回退值 `pageTitle - siteName`，故用 poll 等待稳定值（契约仍为 DB site_title 优先）
    await expect.poll(async () => page.title(), { timeout: 10_000 }).toBe(LOCALES['zh-Hant'].title)

    const head = await readHead(page)
    expect(head.htmlLang).toBe('zh-Hant')
  })

  test('带前缀语言下页面正文文案为对应语言（非默认语言回退）', async ({ page }) => {
    await gotoHome(page, '/en')
    // hero 区角色标签为 i18n 文案，英文页面不应出现中文文案
    const roles = await page.locator('#roles-list .role-item').allInnerTexts()
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
  })
})
