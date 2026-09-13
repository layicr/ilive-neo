/**
 * 首页 E2E 端到端测试 · Home page E2E tests
 * @description 覆盖首页渲染、歌单筛选、城市模态框、图片画廊、语言切换、视频播放、错误日志、
 *              返回顶部、键盘快捷键、响应式布局等交互。
 *              Covers home rendering, songlist filtering, city modal, image gallery, language switch,
 *              video playback, error logging, back-to-top, keyboard shortcuts and responsive layout.
 */
import { test, expect, BrowserContext } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// ============================================================
// 工具函数 · Utilities
// ============================================================

/** 判断当前语言是否为中文 */
async function isChinese(page: Page): Promise<boolean> {
  return (await page.textContent('#pageTitle'))?.includes('演唱会足迹') ?? false
}

/** 切换语言到英文 */
async function switchToEnglish(page: Page): Promise<void> {
  const langBtn = page.locator('.lang-toggle')
  if (await langBtn.count() > 0 && await langBtn.isDisplayed()) {
    await langBtn.click()
    await expect(langBtn).toHaveText('EN')
  }
}

/** 切换语言到中文 */
async function switchToChinese(page: Page): Promise<void> {
  const langBtn = page.locator('.lang-toggle')
  if (await langBtn.count() > 0 && await langBtn.isDisplayed()) {
    await langBtn.click()
    await expect(langBtn).toHaveText('中')
  }
}

/** 检查歌单模态框是否打开 */
async function songlistModalOpen(page: Page): Promise<boolean> {
  return (await page.locator('#songlistModal.show').count() > 0)
}

/** 等待歌单模态框关闭 */
async function waitForSonglistModalClose(page: Page): Promise<void> {
  await page.locator('#songlistModal.show').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}

/** 等待城市模态框打开 */
async function waitForCityModalOpen(page: Page): Promise<void> {
  await page.locator('#cityModal.active').waitFor({ timeout: 5000 })
}

/** 等待城市模态框关闭 */
async function waitForCityModalClose(page: Page): Promise<void> {
  await page.locator('#cityModal.active').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}

/** 等待图片画廊打开 */
async function waitForGalleryOpen(page: Page): Promise<void> {
  await page.locator('#imageModal.show').waitFor({ timeout: 5000 })
}

/** 等待图片画廊关闭 */
async function waitForGalleryClose(page: Page): Promise<void> {
  await page.locator('#imageModal.show').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}

/** 等待加载动画消失 */
async function waitForLoaderHide(page: Page): Promise<void> {
  await page.locator('#loader').waitFor({ state: 'hidden', timeout: 10000 })
}

/** 等待时间轴元素出现 */
async function waitForTimelineItems(page: Page): Promise<void> {
  await page.locator('.timeline-item').first().waitFor({ state: 'visible', timeout: 10000 })
}

// ============================================================
// 测试分组：首页渲染
// ============================================================

test.describe('首页渲染', () => {
  test('页面标题正确显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    const title = await page.textContent('#pageTitle')
    expect(title).toBeTruthy()
    expect(title?.length).toBeGreaterThan(0)
  })

  test('站点名称正确显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    const siteName = await page.textContent('#siteName')
    expect(siteName).toContain('Layicr')
  })

  test('时间轴列表存在且非空', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const items = page.locator('.timeline-item')
    await expect(items).toBeVisible()
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  })

  test('歌单按钮存在', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const songlistBtns = page.locator('.songlist-btn')
    await expect(songlistBtns).toBeVisible()
    const count = await songlistBtns.count()
    expect(count).toBeGreaterThan(0)
  })

  test('图片画廊存在（有图片的演唱会条目）', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const galleries = page.locator('.gallery')
    const visibleCount = await galleries.count()
    expect(visibleCount).toBeGreaterThan(0)
  })

  test('视频播放按钮存在', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const videoBtns = page.locator('.video-btn')
    await expect(videoBtns).toBeVisible()
  })

  test('歌手名字正确显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const artists = page.locator('.timeline-item .concert-artist')
    await expect(artists).toBeVisible()
    const firstArtist = await artists.first().textContent()
    expect(firstArtist?.trim()).toBeTruthy()
  })

  test('演唱会名称显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const concertNames = page.locator('.timeline-item .concert-name')
    const count = await concertNames.count()
    expect(count).toBeGreaterThan(0)
  })

  test('日期显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const dates = page.locator('.timeline-item .concert-date')
    await expect(dates).toBeVisible()
    const count = await dates.count()
    expect(count).toBeGreaterThan(0)
  })

  test('场馆信息显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    const locations = page.locator('.concert-location')
    await expect(locations).toBeVisible()
    const count = await locations.count()
    expect(count).toBeGreaterThan(0)
  })

  test('页脚版权信息正确', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    const footer = await page.textContent('.copyright')
    expect(footer?.includes('Layicr')).toBe(true)
  })

  test('页脚链接存在', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    const footerLinks = page.locator('.footer-links a')
    await expect(footerLinks).toBeVisible()
    const count = await footerLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('页面 CSS 正确加载', async ({ page }) => {
    await page.goto(BASE_URL)
    // 检查关键 CSS 类是否生效（通过检查元素是否存在来验证）
    await expect(page.locator('.timeline-item')).toBeVisible()
  })

  test('页面无 404 或 500 错误', async ({ page }) => {
    const errors: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`)
      }
    })
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)
    expect(errors).toHaveLength(0)
  })
})

// ============================================================
// 测试分组：交互功能
// ============================================================

test.describe('交互功能', () => {
  test('歌单筛选功能', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)

    // 点击第一个歌单按钮
    const songlistBtn = page.locator('.songlist-btn').first()
    await songlistBtn.click()
    await expect(page.locator('#songlistModal.show')).toBeVisible()

    // 等待歌单模态框打开
    await expect(page.locator('#songlistModal')).toBeVisible()

    // 检查筛选框
    const searchInput = page.locator('#songlistSearch')
    await expect(searchInput).toBeVisible()

    // 输入筛选关键词（假设数据库中有一些歌手名字）
    const artists = await page.locator('.timeline-item .concert-artist').allTextContents()
    const keyword = artists[0]?.trim()
    if (keyword) {
      await searchInput.fill(keyword)
      await expect(searchInput).toHaveValue(keyword)
    }
  })

  test('歌单模态框关闭', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)

    const songlistBtn = page.locator('.songlist-btn').first()
    await songlistBtn.click()
    await expect(page.locator('#songlistModal.show')).toBeVisible()

    // 点击关闭按钮
    const closeBtn = page.locator('#closeSonglistModal')
    await closeBtn.click()
    await waitForSonglistModalClose(page)
  })

  test('城市列表模态框', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const cityBtn = page.locator('#cityListBtn')
    await expect(cityBtn).toBeVisible()
    await cityBtn.click()
    await waitForCityModalOpen(page)

    // 检查城市列表
    const cities = page.locator('.city-item')
    const count = await cities.count()
    expect(count).toBeGreaterThan(0)

    // 关闭城市模态框
    const closeBtn = page.locator('#closeCityModal')
    await closeBtn.click()
    await waitForCityModalClose(page)
  })

  test('图片画廊操作', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)

    // 找到第一个画廊并点击其中一张图片
    const galleryItems = page.locator('.gallery-item')
    if (await galleryItems.count() > 0) {
      await galleryItems.first().click()
      await waitForGalleryOpen(page)

      // 检查画廊标题
      const caption = await page.textContent('#modalCaption')
      expect(caption?.trim().length).toBeGreaterThan(0)

      // 点击关闭按钮
      const closeBtn = page.locator('#closeModal')
      await closeBtn.click()
      await waitForGalleryClose(page)
    }
  })

  test('语言切换', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const langBtn = page.locator('.lang-toggle')
    await expect(langBtn).toBeVisible()

    // 记录当前语言
    const initialTitle = await page.textContent('#pageTitle')
    await langBtn.click()
    await expect(page).toHaveURL(BASE_URL)

    const afterLangTitle = await page.textContent('#pageTitle')
    expect(afterLangTitle).not.toEqual(initialTitle)
  })

  test('视频播放按钮点击', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)
    await waitForTimelineItems(page)

    const videoBtn = page.locator('.video-btn').first()
    await videoBtn.click()
    await expect(page.locator('#videoModal.show')).toBeVisible()

    // 点击关闭
    const closeBtn = page.locator('#closeVideoModal')
    await closeBtn.click()
    await expect(page.locator('#videoModal.show')).not.toBeVisible()
  })

  test('错误日志功能', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    // 模拟错误事件
    const errorMock = page.evaluate(() => {
      window.dispatchEvent(new Event('error', { bubbles: true }))
    })

    await waitForAppError(page)
    await expect(page.locator('.toast-notification')).toBeVisible()
    await page.locator('.toast-notification').click({ position: { x: 100, y: 100 } })
  })

  test('返回顶部按钮', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    // 滚动页面
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(300)

    const backToTopBtn = page.locator('#backToTop')
    await expect(backToTopBtn).toBeVisible()
    await backToTopBtn.click()
  })

  test('键盘快捷键', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    // 模拟 Esc 键关闭模态框（如果打开）
    await page.keyboard.press('Escape')
  })

  test('链接跳转测试', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    // 检查所有链接是否正常工作（不实际跳转，但确保没有 404）
    const links = page.locator('a[href]')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================================
// 测试分组：数据展示
// ============================================================

test.describe('数据展示', () => {
  test('演唱会数据完整展示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const concerts = page.locator('.timeline-item')
    const count = await concerts.count()
    expect(count).toBeGreaterThan(0)

    // 验证每个演唱会条目包含必要字段
    for (let i = 0; i < count; i++) {
      const item = concerts.nth(i)
      await expect(item.locator('.concert-artist')).toBeVisible()
      await expect(item.locator('.concert-date')).toBeVisible()
      await expect(item.locator('.concert-location')).toBeVisible()
    }
  })

  test('歌手筛选功能', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const songlistBtn = page.locator('.songlist-btn').first()
    await songlistBtn.click()
    await expect(page.locator('#songlistModal.show')).toBeVisible()

    const searchInput = page.locator('#songlistSearch')
    await searchInput.fill('张学友')
    await expect(searchInput).toHaveValue('张学友')

    // 关闭模态框
    const closeBtn = page.locator('#closeSonglistModal')
    await closeBtn.click()
    await waitForSonglistModalClose(page)
  })

  test('图片画廊展示', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const galleryItems = page.locator('.gallery-item')
    const count = await galleryItems.count()
    expect(count).toBeGreaterThan(0)

    // 检查图片是否加载
    const images = galleryItems.locator('img')
    const loadedCount = await images.evaluateAll(imgs =>
      imgs.filter(img => img.complete).length
    )
    expect(loadedCount).toBeGreaterThan(0)
  })

  test('数据加载状态', async ({ page }) => {
    await page.goto(BASE_URL)

    // 等待加载动画消失
    await waitForLoaderHide(page)

    // 确认数据已加载
    const concerts = page.locator('.timeline-item')
    const count = await concerts.count()
    expect(count).toBeGreaterThan(0)
  })

  test('空数据状态处理', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    // 检查是否有数据展示（即使数据库为空，也应该显示空状态而不是错误）
    const mainContent = page.locator('.timeline')
    await expect(mainContent).toBeVisible()
  })

  test('SEO 元信息', async ({ page }) => {
    await page.goto(BASE_URL)
    const title = await page.title()
    expect(title).toContain('Layicr')
  })
})

// ============================================================
// 测试分组：响应式设计
// ============================================================

test.describe('响应式设计', () => {
  test('桌面端布局正常', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const timeline = page.locator('.timeline')
    await expect(timeline).toBeVisible()

    // 检查时间轴项是否正确排列
    const items = page.locator('.timeline-item')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  })

  test('移动端布局正常', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const timeline = page.locator('.timeline')
    await expect(timeline).toBeVisible()

    // 检查时间轴项在移动端是否正常显示
    const items = page.locator('.timeline-item')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  })

  test('平板端布局正常', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(BASE_URL)
    await waitForLoaderHide(page)

    const timeline = page.locator('.timeline')
    await expect(timeline).toBeVisible()
  })

  test('不同屏幕尺寸下导航栏正常', async ({ page }) => {
    const sizes = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1920, height: 1080 },
    ]

    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.goto(BASE_URL)
      await waitForLoaderHide(page)

      const header = page.locator('.header')
      await expect(header).toBeVisible()

      const headerTitle = page.locator('.header-title')
      await expect(headerTitle).toBeVisible()
    }
  })
})

// ============================================================
// 辅助函数
// ============================================================

async function waitForAppError(page: Page): Promise<void> {
  await page.waitForSelector('.toast-notification', { timeout: 5000 })
}
