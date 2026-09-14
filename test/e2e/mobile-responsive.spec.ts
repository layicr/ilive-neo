/**
 * E2E · 移动端响应式与触摸交互 · Mobile responsiveness & touch
 *
 * 本文件由 playwright.config.ts 中的 `chromium-mobile` project（Pixel 5: 393×851, isMobile, hasTouch）
 * 独占运行；文件内另含 iPhone 12（375×812）尺寸的覆盖用例。
 *
 * 覆盖点
 *  - 移动 viewport 真实生效（尺寸 / 触摸能力）
 *  - 窄屏关键内容可用性（站点名、语言切换、统计、时间轴、相册、许愿）
 *  - 横向溢出检查（首屏 + 打开模态后）
 *  - 触摸交互：语言切换、点赞、模态关闭
 */
import { devices, expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow, gotoHome, waitAppReady } from './helpers'

function countLikeRequests(page: Page): { count: () => number } {
  let n = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/like')) n += 1
  })
  return { count: () => n }
}

test.describe('Pixel 5 移动端（393×851，触摸）', () => {
  test('移动 viewport 与触摸能力真实生效', async ({ page }) => {
    await gotoHome(page, '/')

    // 以 project 实际生效的设备配置为准（Playwright devices 中 Pixel 5 的视口高度会被浏览器 UI 扣减），
    // 避免硬编码 851 与框架定义漂移造成假失败
    expect(page.viewportSize()).toEqual(devices['Pixel 5'].viewport)
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true)
  })

  test('窄屏首页关键内容可见且无横向溢出', async ({ page }) => {
    await gotoHome(page, '/')

    await expect(page.locator('#site-name')).toBeVisible()
    await expect(page.locator('.lang-trigger')).toBeVisible()
    await expect(page.locator('.stats-grid')).toBeVisible()
    await expect(page.locator('.album-card').first()).toBeVisible()
    await expect(page.locator('.timeline-item').first()).toBeVisible()
    await expect(page.locator('#wishGrid .wish-card').first()).toBeVisible()

    await expectNoHorizontalOverflow(page, 'Pixel 5 首页')
  })

  test('触摸交互：语言切换（tap）后路由与文案同步', async ({ page }) => {
    await gotoHome(page, '/')

    await page.locator('.lang-trigger').tap()
    await expect(page.locator('.lang-menu')).toBeVisible()
    await page.locator('.lang-option[data-lang="en"]').tap()

    await expect(page).toHaveURL(/\/en\/?$/)
    await expectNoHorizontalOverflow(page, 'Pixel 5 英文首页')
  })

  test('触摸交互：点赞 tap 生效且不重复请求，可再次取消', async ({ page }) => {
    await gotoHome(page, '/')
    const like = countLikeRequests(page)

    const item = page.locator('.timeline-item[data-concert-id="3"]')
    const btn = item.locator('.like-btn')
    const count = item.locator('.like-count')
    // 相对断言（点赞会持久化到 fixture 库），保证用例可重复执行
    const before = Number((await count.innerText()).trim())

    await btn.tap()
    await expect(btn).toHaveClass(/liked/)
    await expect(count).toHaveText(String(before + 1))

    await page.waitForTimeout(1200)
    expect(like.count()).toBe(1)

    await btn.tap()
    await page.waitForTimeout(1200)
    expect(like.count()).toBe(2)
    await expect(btn).not.toHaveClass(/liked/)
    await expect(count).toHaveText(String(before))
  })

  test('打开城市弹窗与歌单模态后仍无横向溢出，且可触摸关闭', async ({ page }) => {
    await gotoHome(page, '/')

    // 移动端打开城市弹窗的入口是城市统计卡 #city-card（#cityList 内的条目在窄屏下不参与展示）
    await page.locator('#city-card').tap()
    await expect(page.locator('#cityModal')).toHaveClass(/active/)
    // 等模态淡入 / 位移动画（transition 0.4s）结束：动画期间坐标漂移会让 tap 被 .city-modal-header 拦截
    await page.waitForTimeout(700)
    await expectNoHorizontalOverflow(page, 'Pixel 5 城市弹窗')
    await page.locator('#closeCityModal').tap()
    await expect(page.locator('#cityModal')).not.toHaveClass(/active/)

    await page.locator('.timeline-item[data-concert-id="1"] .songlist-btn').tap()
    await expect(page.locator('#songlistModal')).toHaveClass(/show/)
    await page.waitForTimeout(700)
    await expectNoHorizontalOverflow(page, 'Pixel 5 歌单模态')
    await page.locator('#closeSonglistModal').tap()
    await expect(page.locator('#songlistModal')).not.toHaveClass(/show/)
  })

  test('滚动后返回顶部按钮可用（触摸）', async ({ page }) => {
    await gotoHome(page, '/')

    const backToTop = page.locator('#backToTop')
    // 滚动到页面中部：既满足按钮出现条件（.visible），又避免滚至页脚正上方时按钮被 .footer-content
    // 遮挡（该遮挡已作为真实缺陷记录，见交付说明，本轮不擅自改动站点样式）
    // 同时关闭平滑滚动：smooth scroll 在 tap 期间持续改变元素位置，会导致 actionability 反复失败
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(0, Math.round(document.body.scrollHeight * 0.5))
    })
    await expect(backToTop).toHaveClass(/visible/)
    await page.waitForTimeout(600)

    await backToTop.tap()
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThan(120)
  })
})

test.describe('iPhone 12 尺寸（375×812，触摸）', () => {
  // 只取 iPhone 12 的视口 / UA / 触摸参数：直接展开 devices['iPhone 12'] 会带上
  // defaultBrowserType: 'webkit'，在 chromium-mobile project 内会尝试拉起未安装的 WebKit 浏览器。
  test.use({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 12'].userAgent
  })

  test('iPhone 尺寸下无横向溢出且核心内容可用', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitAppReady(page)

    expect(page.viewportSize()?.width).toBe(375)
    await expect(page.locator('#site-name')).toBeVisible()
    await expect(page.locator('.timeline-item').first()).toBeVisible()

    await expectNoHorizontalOverflow(page, 'iPhone 12 首页')
  })

  test('iPhone 尺寸下打开相册详情并切换后无横向溢出', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitAppReady(page)

    await page.locator('#nextConcert').tap()
    await expect(page.locator('#detailTitle')).not.toBeEmpty()
    await expectNoHorizontalOverflow(page, 'iPhone 12 详情切换后')
  })
})
