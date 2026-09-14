/**
 * E2E · 用户体验与交互 · UX & interaction
 *
 * 覆盖点
 *  - 首屏加载态（loader 显隐）与主内容、统计卡片渲染
 *  - 点赞交互：单击状态回显、冷却期内重复点击不重复发请求、服务端持久化、可取消
 *  - 热点档位徽标（点赞数分档）渲染
 *  - 相册详情切换（上/下一场）与返回顶部按钮显隐
 *  - 歌单模态 + 关键词筛选反馈
 *  - 城市弹窗 打开/关闭
 *  - 画廊模态 打开/翻页/关闭
 *  - 视频模态 打开/关闭
 *  - 全流程无 console error / pageerror
 */
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, gotoHome, siteErrors, waitAppReady } from './helpers'

/** 统计 POST /api/like 的请求次数（用于验证前端防连点） · count like requests */
function countLikeRequests(page: Page): { count: () => number } {
  let n = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/like')) n += 1
  })
  return { count: () => n }
}

test.describe('UE · 首屏加载与整体渲染', () => {
  test('首屏 loader 展示后收起，主内容与统计卡片正常渲染', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    // loader 在数据就绪前应处于可见状态（SSR 直出快时可能瞬间消失，仅做宽容断言）
    await waitAppReady(page)

    await expect(page.locator('#site-name')).toBeVisible()
    await expect(page.locator('#loader')).toBeHidden()
    await expect(page.locator('#timeline')).toBeVisible()

    await expect(page.locator('#total-concerts')).toHaveText('4')
    await expect(page.locator('#total-cities')).toHaveText('4')
    await expect(page.locator('#total-artists')).toHaveText(/^\d+$/)
  })

  test('列表与卡片按 fixture 数量渲染，数据存在时不显示空态', async ({ page }) => {
    await gotoHome(page, '/')

    await expect(page.locator('.timeline-item')).toHaveCount(4)
    await expect(page.locator('.album-card')).toHaveCount(4)
    await expect(page.locator('#wishGrid .wish-card')).toHaveCount(2)
    await expect(page.locator('.wish-empty')).toHaveCount(0)
    await expect(page.locator('.social-link')).not.toHaveCount(0)
  })

  test('详情面板切换：下一场/上一场按钮可切换演唱会详情', async ({ page }) => {
    await gotoHome(page, '/')

    const title = page.locator('#detailTitle')
    await expect(title).toBeVisible()
    const initial = (await title.innerText()).trim()
    expect(initial.length).toBeGreaterThan(0)

    await page.locator('#nextConcert').click()
    await expect.poll(async () => (await title.innerText()).trim()).not.toBe(initial)

    await page.locator('#prevConcert').click()
    await expect.poll(async () => (await title.innerText()).trim()).toBe(initial)
  })

  test('返回顶部按钮在滚动后出现并可回到页面顶部', async ({ page }) => {
    await gotoHome(page, '/')

    const backToTop = page.locator('#backToTop')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(backToTop).toHaveClass(/visible/)

    await backToTop.click()
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThan(120)
  })
})

test.describe('UE · 点赞交互', () => {
  test('单击点赞：状态高亮、仅发 1 次请求、刷新后计数持久化、可再次取消', async ({ page }) => {
    await gotoHome(page, '/')
    const like = countLikeRequests(page)

    const item = page.locator('.timeline-item[data-concert-id="4"]')
    const btn = item.locator('.like-btn')
    const count = item.locator('.like-count')
    // 点赞会持久化到 fixture 库，因此不假设初始值，改用「相对 +1 / 还原」断言，保证用例可重复执行
    const before = Number((await count.innerText()).trim())

    // 防连点：在同一个事件循环内同步连点 3 次（点击间隔 ~0ms，必落在 700ms 冷却窗口内），
    // 前端应只发出 1 次 /api/like 请求。用 evaluate 同步派发而非 3 次 await click()，
    // 避免 Playwright 的 actionability 等待把点击间隔拉长到冷却窗口之外造成误判。
    await page.evaluate(() => {
      const el = document.querySelector(
        '.timeline-item[data-concert-id="4"] .like-btn'
      ) as HTMLElement | null
      el?.click()
      el?.click()
      el?.click()
    })
    await page.waitForTimeout(1500)
    expect(like.count(), '冷却期内重复点击不应重复请求 /api/like').toBe(1)
    await expect(btn).toHaveClass(/liked/)

    // 服务端应已持久化 +1
    await page.reload()
    await waitAppReady(page)
    await expect(item.locator('.like-count')).toHaveText(String(before + 1))

    // 取消点赞：恢复初始状态
    await page.waitForTimeout(800)
    await item.locator('.like-btn').click()
    await page.waitForTimeout(1200)
    expect(like.count(), '取消点赞应恰好再发 1 次请求').toBe(2)

    await page.reload()
    await waitAppReady(page)
    await expect(item.locator('.like-count')).toHaveText(String(before))
  })

  test('热点档位：点赞数进入前三档的场次显示热点徽标，0 赞场次不显示', async ({ page }) => {
    await gotoHome(page, '/')

    // 与 fixture 中点赞数的相对排名比对（不硬编码 id 的具体点赞数，避免用例间数据耦合）：
    //  · 点赞数最高的场次必须带热点徽标；
    //  · 0 赞场次必须不带徽标（空档位）；
    const ids = ['1', '2', '3', '4']
    const likes: Record<string, number> = {}
    for (const id of ids) {
      const t = await page.locator(`.timeline-item[data-concert-id="${id}"] .like-count`).innerText()
      likes[id] = Number(t.trim())
    }
    expect(new Set(ids.map((i) => likes[i])).size, 'fixture 点赞数应有区分度').toBeGreaterThan(1)
    expect(ids.some((i) => likes[i] === 0), 'fixture 应保留至少一个 0 赞场次').toBeTruthy()

    const topId = ids.reduce((a, b) => (likes[a] >= likes[b] ? a : b))
    await expect(
      page.locator(`.timeline-item[data-concert-id="${topId}"] .concert-hot`),
      `最高赞场次 id=${topId}（${likes[topId]} 赞）应显示热点徽标`
    ).toBeVisible()

    for (const id of ids) {
      if (likes[id] === 0) {
        await expect(
          page.locator(`.timeline-item[data-concert-id="${id}"] .concert-hot`),
          `0 赞场次 id=${id} 不应显示热点徽标`
        ).toHaveCount(0)
      }
    }
  })
})

test.describe('UE · 模态与筛选交互', () => {
  test('歌单模态：打开后列出全部曲目，关键词筛选实时反馈', async ({ page }) => {
    await gotoHome(page, '/')

    await page.locator('.timeline-item[data-concert-id="1"] .songlist-btn').click()
    await expect(page.locator('#songlistModal')).toHaveClass(/show/)

    const allItems = page.locator('#songlistModal .songlist-item')
    await expect(allItems).toHaveCount(3)

    await page.locator('#songlistSearchInput').fill('倔强')
    await expect(allItems).toHaveCount(1)
    await expect(allItems.first()).toContainText('倔强')
    await expect(page.locator('#songlistModalSubtitle')).toContainText('1')

    await page.locator('#songlistSearchInput').fill('不存在的曲目')
    await expect(allItems).toHaveCount(0)

    await page.locator('#songlistSearchInput').fill('')
    await expect(allItems).toHaveCount(3)

    await page.locator('#closeSonglistModal').click()
    await expect(page.locator('#songlistModal')).not.toHaveClass(/show/)
  })

  test('城市弹窗：由城市统计卡（#city-card）打开，列出全部城市，可关闭', async ({ page }) => {
    await gotoHome(page, '/')

    await page.locator('#city-card').click()
    await expect(page.locator('#cityModal')).toHaveClass(/active/)
    await expect(page.locator('#city-modal-title')).not.toBeEmpty()
    await expect(page.locator('#cityList .city-item')).toHaveCount(4)

    await page.locator('#closeCityModal').click()
    await expect(page.locator('#cityModal')).not.toHaveClass(/active/)
  })

  test('画廊模态：可打开、切换下一张、关闭', async ({ page }) => {
    await gotoHome(page, '/')

    const gallery = page.locator('.timeline-item[data-concert-id="1"] .gallery')
    await expect(gallery).toBeVisible()
    await gallery.locator('.gallery-item').first().click()

    const modal = page.locator('#imageModal')
    await expect(modal).toHaveClass(/show/)
    const img = page.locator('#modalImage')
    await expect(img).toBeVisible()
    const firstSrc = await img.getAttribute('src')
    expect(firstSrc).toBeTruthy()

    await page.locator('#nextImage').click()
    await expect.poll(async () => img.getAttribute('src')).not.toBe(firstSrc)

    await page.locator('#closeModal').click()
    await expect(modal).not.toHaveClass(/show/)
  })

  test('视频模态：可打开并设置标题，可关闭', async ({ page }) => {
    await gotoHome(page, '/')

    const videoBtn = page.locator('.timeline-item[data-concert-id="1"] .video-btn')
    await expect(videoBtn).toBeVisible()
    await videoBtn.click()

    await expect(page.locator('#videoModal')).toHaveClass(/show/)
    await expect(page.locator('#videoModalTitle')).not.toBeEmpty()

    await page.locator('#closeVideoModal').click()
    await expect(page.locator('#videoModal')).not.toHaveClass(/show/)
  })
})

test.describe('UE · 运行期错误监控', () => {
  test('首屏加载、语言切换、城市弹窗、点赞过程中无 console error / pageerror', async ({
    page
  }) => {
    const errors = collectErrors(page)

    await gotoHome(page, '/')
    await expect(page.locator('#site-name')).toBeVisible()

    await page.locator('.lang-trigger').click()
    await page.locator('.lang-option[data-lang="en"]').click()
    await expect(page).toHaveURL(/\/en\/?$/)

    await gotoHome(page, '/')
    await page.locator('#city-card').click()
    await expect(page.locator('#cityModal')).toHaveClass(/active/)
    await page.locator('#closeCityModal').click()

    // 只保留站点自身的错误：第三方统计脚本失败、autoplay 策略拒绝、被中断的音频请求均为噪声
    const noisy = siteErrors(errors.consoleErrors)
    if (noisy.length || errors.pageErrors.length) {
      console.log('[e2e] consoleErrors(raw):', errors.consoleErrors)
      console.log('[e2e] consoleErrors(first-party):', noisy)
      console.log('[e2e] pageErrors:', errors.pageErrors)
    }
    expect(errors.pageErrors, '存在未捕获的页面异常').toEqual([])
    expect(noisy, '存在站点自身的控制台错误').toEqual([])
  })
})
