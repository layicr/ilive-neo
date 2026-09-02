import { describe, it, expect } from 'vitest'
import { safeHtml } from '../../app/utils/index'

describe('safeHtml — 安全 HTML 净化（纯正则，SSR 安全）', () => {
  it('保留白名单标签', () => {
    expect(safeHtml('<b>bold</b>')).toBe('<b>bold</b>')
  })

  it('br 开启与自闭合形式统一输出', () => {
    expect(safeHtml('<br>line1<br/>line2')).toBe('<br>line1<br>line2')
  })

  it('非白名单标签剥标签保内容', () => {
    expect(safeHtml('<div>text <b>bold</b></div>')).toBe('text <b>bold</b>')
  })

  it('危险块（script 等）连同内容移除', () => {
    expect(safeHtml('<script>alert(1)</script>safe')).toBe('safe')
  })

  it('span 保留合法 style', () => {
    expect(safeHtml('<span style="color:red">hi</span>')).toBe('<span style="color:red">hi</span>')
  })

  it('span 事件属性被剥（保留 style）', () => {
    expect(safeHtml('<span onclick="x()" style="color:red">hi</span>')).toBe('<span style="color:red">hi</span>')
  })

  it('危险 href（javascript:）剥除', () => {
    expect(safeHtml('<a href="javascript:alert(1)">x</a>')).toBe('x')
  })

  it('自闭合危险标签（img onerror）移除', () => {
    expect(safeHtml('<img src=x onerror=alert(1)>')).toBe('')
  })

  it('注释移除', () => {
    expect(safeHtml('<!-- comment -->ok')).toBe('ok')
  })

  it('实体保持不变', () => {
    expect(safeHtml('<p><em>italic</em> &amp; text</p>')).toBe('<p><em>italic</em> &amp; text</p>')
  })

  it('非字符串原样返回', () => {
    expect(safeHtml(null)).toBe(null)
    expect(safeHtml(undefined)).toBe(undefined)
    expect(safeHtml(42)).toBe(42)
  })
})