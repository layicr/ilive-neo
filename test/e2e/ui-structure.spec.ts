/**
 * E2E · 页面结构、静态资源与基础可用性 · Page structure, assets & basic usability
 *
 * 说明：本文件取代早期 `ui.spec.ts`（后者选择器已全部失效）。
 *
 * 覆盖点
 *  - 站点名 / 副标题 / 角色标签、相册详情、时间轴条目、页脚 的结构化字段渲染
 *  - 关键静态资源可访问（HTTP 200）
 *  - 首页同源资源无失败请求（>=400），样式表已加载
 *  - 语言下拉：点击展开（v-show 可见性）→ 外部点击 / Esc 收起
 *  - 背景音乐按钮初始态与切换态（.playing）
 *
 * 本阶段修正（对实际 DOM 契约）
 *  - 语言菜单由 `v-show="langOpen"` 控制显隐，**没有** `open` 类 → 断言改为可见性，而非 class
 *  - 页脚 tagline（#footer-text）在三种语言下均为「有意留空」，不再断言其非空
 */
import { expect, test } from '@playwright/test'
import { gotoHome, isSameOrigin } from './helpers'

test.describe('页面结构渲染', () => {
  test('hero 区：站点名、副标题、角色标签渲染完整', async ({ page }) => {
    await gotoHome(page, '/')

    await expect(page.locator('#site-name')).toContainText('Layicr')
    await expect(page.locator('#profile-subtitle')).not.toBeEmpty()

    const roles = page.locator('#roles-list .role-item')
    expect(await roles.count()).toBeGreaterThan(0)
    for (const text of await roles.allInnerTexts()) {
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  test('相册详情面板：标题、日期与时间轴条目字段非空', async ({ page }) => {
    await gotoHome(page, '/')

    await expect(page.locator('#detailTitle')).not.toBeEmpty()
    await expect(page.locator('#detailDate')).not.toBeEmpty()

    const firstItem = page.locator('.timeline-item').first()
    await expect(firstItem.locator('.concert-name')).not.toBeEmpty()
    await expect(firstItem.locator('.concert-artist')).not.toBeEmpty()
    await expect(firstItem.locator('.concert-date')).not.toBeEmpty()
    await expect(firstItem.locator('.concert-location')).not.toBeEmpty()
  })

  test('时间轴条目包含标签与点赞计数等结构化元素', async ({ page }) => {
    await gotoHome(page, '/')

    const item = page.locator('.timeline-item[data-concert-id="1"]')
    await expect(item.locator('.concert-tags .tag').first()).toBeVisible()
    await expect(item.locator('.like-count')).toHaveText('3')
    await expect(item.locator('.songlist-btn')).toBeVisible()
    await expect(item.locator('.video-btn')).toBeVisible()
    await expect(item.locator('.gallery .gallery-item').first()).toBeVisible()
  })

  test('相册卡片：点击切换选中相册，详情标题随之变化', async ({ page }) => {
    await gotoHome(page, '/')

    const title = page.locator('#detailTitle')
    const initial = (await title.innerText()).trim()
    expect(initial.length).toBeGreaterThan(0)

    // 3D 相册堆叠中的卡片长期处于 transform 过渡/动画中，且非激活卡片常被堆叠层遮挡：
    //  Playwright 的 click 过不了 stability 检查、按坐标 force 点击也会打到上层元素，
    //  故直接 dispatch click 事件；同时相册切换带布局动画锁，改为轮询重试点击直到标题变化。
    await expect
      .poll(
        async () => {
          await page.locator('.album-card[data-index="1"]').dispatchEvent('click')
          return (await title.innerText()).trim()
        },
        { timeout: 20_000, intervals: [800, 1200, 1500] }
      )
      .not.toBe(initial)
  })

  test('页脚：品牌区与社交外链渲染（tagline 三种语言均为有意留空）', async ({ page }) => {
    await gotoHome(page, '/')

    await expect(page.locator('footer.footer')).toBeVisible()
    await expect(page.locator('.footer-content')).toBeVisible()

    // 说明：页脚品牌区内的 logo / divider / tagline 文案在 i18n/locales 中均显式留空（三个子元素文本为空），
    // 导致 .footer-brand 容器高度为 0 —— Playwright 将其判定为 hidden。
    // 因此这里只固化「结构存在 + tagline 为空」的契约，不断言容器可见性。
    await expect(page.locator('.footer-brand')).toHaveCount(1)
    await expect(page.locator('.footer-logo')).toHaveCount(1)
    await expect(page.locator('#footer-text')).toHaveText('')

    const links = page.locator('.social-link')
    expect(await links.count()).toBeGreaterThanOrEqual(2)
    await expect(links.first()).toHaveAttribute('href', /^https?:\/\//)
  })
})

test.describe('关键静态资源可访问', () => {
  const assets = [
    '/img/logo.jpg',
    '/music/bgm_cn.mp3',
    '/music/bgm_en.mp3',
    '/concert/20160903/01.jpg',
    '/concert/20160903/01_thumb.jpg'
  ]

  test('站点主图、背景音乐与演唱会图片均返回 200', async ({ request }) => {
    for (const asset of assets) {
      const res = await request.get(asset)
      expect(res.status(), `${asset} 应可访问`).toBe(200)
    }
  })

  test('首页样式表加载成功且同源资源无失败请求', async ({ page }) => {
    const failed: string[] = []
    page.on('response', (res) => {
      // 第三方统计脚本的 403/超时不计入本断言（非站点自身资源）
      if (!isSameOrigin(res.url())) return
      if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`)
    })

    await gotoHome(page, '/')
    const cssCount = await page.locator('link[rel="stylesheet"]').count()
    expect(cssCount).toBeGreaterThan(0)
    expect(failed, `存在失败的同源请求：${failed.join(' | ')}`).toEqual([])
  })
})

test.describe('语言下拉与音乐按钮', () => {
  test('语言下拉：点击展开（3 个语言项），点击页面空白处收起', async ({ page }) => {
    await gotoHome(page, '/')

    const menu = page.locator('.lang-menu')
    await expect(menu).toBeHidden()

    await page.locator('.lang-trigger').click()
    await expect(menu).toBeVisible()
    await expect(menu.locator('.lang-option')).toHaveCount(3)

    // 点击页面左上角空白区域 → 外部点击收起
    await page.mouse.click(8, 8)
    await expect(menu).toBeHidden()
  })

  test('语言下拉：Esc 键可收起', async ({ page }) => {
    await gotoHome(page, '/')

    const menu = page.locator('.lang-menu')
    await page.locator('.lang-trigger').click()
    await expect(menu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('背景音乐按钮：点击可在播放态与暂停态之间切换（.playing）', async ({ page }) => {
    await gotoHome(page, '/')

    const btn = page.locator('#musicToggle')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-label', /音乐|music/i)

    // 说明 1：E2E 的 launchOptions 已放开 autoplay 策略，页面加载后背景音乐可能已自动进入播放态，
    //         故不假设初始态，只固化「点击 → 状态翻转」的 toggle 契约。
    // 说明 2：.music-btn.playing 带 2s 无限 pulse 动画，元素永远无法通过 Playwright 的 stability 检查，
    //         因此必须用 force 点击（仍会触发真实 click 处理逻辑）。
    const wasPlaying = ((await btn.getAttribute('class')) ?? '').includes('playing')

    await btn.click({ force: true })
    if (wasPlaying) {
      await expect(btn).not.toHaveClass(/playing/)
    } else {
      await expect(btn).toHaveClass(/playing/)
    }

    await btn.click({ force: true })
    if (wasPlaying) {
      await expect(btn).toHaveClass(/playing/)
    } else {
      await expect(btn).not.toHaveClass(/playing/)
    }
  })
})
