/**
 * E2E · 安全边界 · Security boundaries
 *
 * 覆盖点
 *  - 公开静态目录敏感文件不可直接下载（public/data/data.db、schema、.env 等）
 *  - XSS 载荷真实渲染不执行（description 的 v-html + JSON-LD 注入）
 *  - 外链 rel 安全属性 & 伪协议 href 白名单过滤
 *  - API 非法参数响应（400 / 404 而不是 500 或静默成功）
 *
 * 说明：本 spec 只做「读外部行为」的断言，不写入任何真实数据；
 *       点赞接口的非法参数用例均使用不存在的 id，不会污染 fixture 中的点赞数。
 */
import { expect, test } from '@playwright/test'
import { gotoHome } from './helpers'

test.describe('公开静态目录敏感文件不可下载', () => {
  test('public/data/data.db 不可通过 HTTP 直接下载', async ({ request }) => {
    // ⚠️ 已知真实缺陷（计入本阶段交付结果，暂未修复）：
    //    Nitro 静态服务未拦截 public/data/，任何访客可直接下载整库 SQLite 文件（信息泄露，定级 H2）。
    //    修复路径（加 nitro routeRules / server middleware 拦截 /data/**）会改变对外可访问性，
    //    可能影响运维的数据库下载通道 → 属「需用户决策」项，本阶段不擅自改动。
    //    因此本用例以「预期失败」登记：一旦缺陷修复，Playwright 会提示 "expected to fail but passed"，
    //    届时移除 test.fail() 即可转为正向断言。
    test.fail(true, '已知缺陷：public/data/data.db 可被直链下载，修复方案需用户决策')

    const res = await request.get('/data/data.db')
    expect(res.status(), 'data.db 位于 public 静态目录时会被整库下载（安全缺陷）').not.toBe(200)

    // 双保险：即便返回非 200，也不能有人可读的 SQLite 文件头
    const body = await res.body().catch(() => Buffer.from(''))
    expect(body.subarray(0, 15).toString('latin1')).not.toContain('SQLite format')
  })

  test('服务端源码与配置文件不可通过 HTTP 访问', async ({ request }) => {
    const paths = ['/.env', '/server/db/schema.sql', '/package.json', '/nuxt.config.ts']
    for (const p of paths) {
      const res = await request.get(p)
      expect(res.status(), `${p} 不应可被公网读取`).not.toBe(200)
    }
  })
})

test.describe('XSS 载荷真实渲染不执行', () => {
  test('description 中的 script/img onerror 载荷被净化，不产生副作用', async ({ page }) => {
    await gotoHome(page, '/')

    const injected = await page.evaluate(() => ({
      desc: (window as unknown as Record<string, unknown>).__xssDesc ?? null,
      desc2: (window as unknown as Record<string, unknown>).__xssDesc2 ?? null
    }))
    expect(injected.desc, 'description 内 <script> 被当作 HTML 执行').toBeNull()
    expect(injected.desc2, 'description 内 onerror 属性被保留并触发').toBeNull()

    // 净化函数保留白名单标签（<b>），因此正文仍应可见
    const descBlock = page.locator('.concert-description').first()
    if (await descBlock.count()) {
      const html = await descBlock.first().innerHTML()
      expect(html).not.toContain('<script')
      expect(html.toLowerCase()).not.toContain('onerror')
    }
  })

  test('JSON-LD 结构数据注入 </script> 不能逃逸，且 JSON 结构仍可解析', async ({ page }) => {
    await gotoHome(page, '/')

    const jsonLdCheck = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      return {
        count: nodes.length,
        parseErrors: nodes
          .map((n) => {
            try {
              JSON.parse(n.textContent || '')
              return ''
            } catch (e) {
              return String(e)
            }
          })
          .filter(Boolean),
        executed: (window as unknown as Record<string, unknown>).__xssJsonLd ?? null
      }
    })

    expect(jsonLdCheck.executed, 'JSON-LD 内 </script> 逃逸并执行了脚本').toBeNull()
    expect(jsonLdCheck.count).toBeGreaterThan(0)
    expect(jsonLdCheck.parseErrors, 'JSON-LD 被未转义的 </script> 截断').toEqual([])
  })
})

test.describe('外链安全属性与伪协议白名单', () => {
  test('页脚外链均带 rel=noopener，且不存在伪协议 href', async ({ page }) => {
    await gotoHome(page, '/')

    const links = page.locator('.social-link')
    const count = await links.count()
    expect(count, '页脚友情链接应有正常条目').toBeGreaterThanOrEqual(2)

    for (let i = 0; i < count; i++) {
      const rel = (await links.nth(i).getAttribute('rel')) ?? ''
      expect(rel, `第 ${i + 1} 条外链缺少 noopener`).toContain('noopener')
    }

    const dangerous = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href') || '')
        .filter(
          (href) =>
            /^\s*javascript:/i.test(href) ||
            /^\s*data:/i.test(href) ||
            /^\s*vbscript:/i.test(href) ||
            href.startsWith('//')
        )
    )
    expect(dangerous, '页面中存在伪协议/协议相对链接').toEqual([])
  })

  test('歌单外链带 rel=noopener（含 https 外链条目）', async ({ page }) => {
    await gotoHome(page, '/')

    const songlistBtn = page.locator('.timeline-item[data-concert-id="1"] .songlist-btn')
    await expect(songlistBtn).toBeVisible()
    await songlistBtn.click()
    await expect(page.locator('#songlistModal')).toHaveClass(/show/)

    const playBtn = page.locator('#songlistModal .songlist-play-btn').first()
    if (await playBtn.count()) {
      const rel = (await playBtn.first().getAttribute('rel')) ?? ''
      expect(rel).toContain('noopener')
    }
  })
})

test.describe('API 非法参数响应', () => {
  test('GET /api/concerts/:id 非数字 id 返回 400，不存在的 id 返回 404', async ({ request }) => {
    for (const id of ['abc', '-1', '1.5']) {
      const res = await request.get(`/api/concerts/${id}`)
      expect(res.status(), `/api/concerts/${id} 应返回 400`).toBe(400)
    }

    // '0' 满足「纯数字」格式但不存在记录，服务端按 404 处理（400 的分界是「非正整数格式」）
    const zero = await request.get('/api/concerts/0')
    expect(zero.status()).toBe(404)

    const missing = await request.get('/api/concerts/999999')
    expect(missing.status()).toBe(404)

    const ok = await request.get('/api/concerts/1')
    expect(ok.status()).toBe(200)
    const payload = await ok.json()
    expect(payload.id).toBe(1)
    expect(payload.artist, '详情接口应返回原始多语言字段').toBeTruthy()
    // 注意：聚合/详情接口返回的是**原始 i18n 数据**（description 字段即保留 XSS 载荷原文），
    // 净化发生在渲染层（safeHtml / v-html 白名单），其效果由上方「XSS 载荷真实渲染不执行」用例负责断言。
  })

  test('POST /api/like 对非法载荷返回 400、不存在目标返回 404', async ({ request }) => {
    const cases: { body: Record<string, unknown>; expected: number; label: string }[] = [
      { body: {}, expected: 400, label: '空载荷' },
      { body: { id: 'abc' }, expected: 400, label: '非数字 id' },
      { body: { id: -3 }, expected: 400, label: '负数 id' },
      { body: { id: 999999 }, expected: 404, label: '不存在的演唱会' }
    ]

    for (const c of cases) {
      const res = await request.post('/api/like', { data: c.body })
      expect(res.status(), `/api/like ${c.label} 应返回 ${c.expected}`).toBe(c.expected)
    }
  })

  test('GET /api/data 按语言返回本地化数据，未知语言回退默认语言', async ({ request }) => {
    const zh = await request.get('/api/data?lang=zh-CN')
    expect(zh.status()).toBe(200)
    const zhData = await zh.json()
    // 聚合端点响应体为 { data: {...}, generatedAt }，业务数据挂在 data 下
    expect(zhData.data.concerts.length).toBeGreaterThan(0)
    expect(zhData.data.locale).toBe('zh-CN')

    // 未知语言：locale 落 null，返回未本地化的多语言原始数据（本地化回退由前端 pickLocale 负责）
    const unknown = await request.get('/api/data?lang=xx-XX')
    expect(unknown.status()).toBe(200)
    const unknownData = await unknown.json()
    expect(unknownData.data.locale, '未知语言不应被当作已知 locale').toBeNull()
    expect(unknownData.data.concerts.length).toBe(zhData.data.concerts.length)

    // 无 lang 参数：同样返回多语言原始结构（前端按当前 locale 本地化）
    const plain = await request.get('/api/data')
    expect(plain.status()).toBe(200)
    const plainData = await plain.json()
    expect(plainData.data.concerts.length).toBe(zhData.data.concerts.length)
  })
})
