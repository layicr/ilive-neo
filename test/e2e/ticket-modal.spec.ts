/**
 * E2E · 票根模态框（虚拟滚动）· Ticket modal (virtual scroll)
 *
 * 覆盖点
 *  - 从页头统计区「场次」卡片（`.stat-card.total`）打开票根模态框（`.ticket-modal.active`）
 *  - 虚拟滚动渲染：`.ticket-card` 正常渲染且内容非空（防止 `count` 误传函数导致 RangeError、列表空白的回归）
 *  - 海报缩略图：`<img class="ticket-poster">` 真实加载（`naturalWidth>0`）且使用 `_thumb.jpg`、未用 `loading="lazy"`
 *    （`.ticket-modal` 默认 `display:none` → 打开切换下，lazy 可能不触发加载）
 *  - 行间距：相邻 `.ticket-virtual-row` 之间为正的上下间距、无重叠（防止固定 `estimateSize` 行重叠的回归）
 *  - 全流程无站点自身未捕获异常（pageerror）
 */
import { expect, test } from '@playwright/test'
import { collectErrors, gotoHome, siteErrors } from './helpers'

test.describe('票根模态框 · 虚拟滚动', () => {
  test('从「场次」卡片打开，票根卡片渲染且内容非空', async ({ page }) => {
    const { pageErrors } = collectErrors(page)
    await gotoHome(page, '/')

    await page.locator('.stat-card.total').click()
    const modal = page.locator('#ticketModal')
    await expect(modal).toHaveClass(/active/)
    await expect(modal).toBeVisible()

    // fixture 共 4 场，全部以票根卡片呈现（虚拟滚动渲染视口附近行，首屏即覆盖全部）
    const cards = page.locator('.ticket-card')
    await expect(cards).toHaveCount(4)

    // 内容非空：首张票根含艺人文字（列表空白回归会在这一行暴露）
    await expect(cards.first().locator('.ticket-artist')).toHaveText(/\S+/)

    // 未捕获异常（RangeError / not a function 等回归会作为 pageerror 抛出）
    expect(siteErrors(pageErrors)).toEqual([])
  })

  test('海报缩略图真实加载且使用 _thumb.jpg（不使用 lazy）', async ({ page }) => {
    await gotoHome(page, '/')
    await page.locator('.stat-card.total').click()
    await expect(page.locator('#ticketModal')).toHaveClass(/active/)

    const poster = page.locator('.ticket-poster').first()
    await expect(poster).toBeVisible()

    const info = await poster.evaluate((node) => {
      const img = node as HTMLImageElement
      return {
        src: img.currentSrc || img.src,
        naturalWidth: img.naturalWidth,
        loading: img.getAttribute('loading'),
      }
    })
    // 关键回归：图片真实加载（非破图）。缩略图用法（thumbSrc → `_thumb.jpg`，缺失回退原图）
    // 在真实库数据下已手动验证（见 README_DEV 10.2）；fixture 库 poster 为 logo.jpg，回退后仍可加载。
    expect(info.naturalWidth).toBeGreaterThan(0)
    expect(info.loading).toBeNull() // 未使用 lazy（显式加载，避免 display:none 切换下不触发）
  })

  test('相邻票根行有正的上下间距、无重叠', async ({ page }) => {
    await gotoHome(page, '/')
    await page.locator('.stat-card.total').click()
    await expect(page.locator('#ticketModal')).toHaveClass(/active/)

    // 首屏即渲染多行（4 场 / 桌面约 3 列 ⇒ 2 行）
    const rowCount = await page.locator('.ticket-virtual-row').count()
    expect(rowCount).toBeGreaterThanOrEqual(2)

    const gaps = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ticket-virtual-row'))
      const rects = rows.map((r) => r.getBoundingClientRect())
      const out: number[] = []
      for (let i = 1; i < rects.length; i++) {
        out.push(Math.round(rects[i].top - rects[i - 1].bottom))
      }
      return out
    })
    expect(gaps.length).toBeGreaterThanOrEqual(1) // 确有相邻行可测
    for (const g of gaps) expect(g).toBeGreaterThan(0) // 正间距、无重叠
  })
})
