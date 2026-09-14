/**
 * safeHtml 单元测试 · Unit tests for safeHtml
 * @description 验证白名单标签保留、非白名单标签剥标签保内容、属性丢弃、script/style 块移除（SSR 安全）。
 *              Verifies whitelist preservation, tag-stripping-keep-content, attribute dropping and
 *              script/style block removal (SSR-safe).
 */
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

describe('safeHtml — XSS 绕过专项（净化器绕过 / 大小写 / 实体编码 / 属性注入）', () => {
  it('危险块大小写混写仍被整块移除（SCRIPT / IfRaMe / STYLE）', () => {
    expect(safeHtml('<SCRIPT>alert(1)</SCRIPT>ok')).toBe('ok')
    expect(safeHtml('<IfRaMe src="https://evil.test"></IfRaMe>ok')).toBe('ok')
    expect(safeHtml('<STYLE>body{background:url(x)}</STYLE>ok')).toBe('ok')
  })

  it('form / object 块连同内部白名单标签一并移除（不留可提交控件）', () => {
    expect(safeHtml('<form action="/x"><input name="a"><b>y</b></form>ok')).toBe('ok')
    expect(safeHtml('<object data="x"><b>y</b></object>')).toBe('')
  })

  it('无闭合的自闭合危险标签（embed）被剥标签', () => {
    expect(safeHtml('<embed src="x">ok')).toBe('ok')
  })

  it('事件属性（onmouseover / onclick / onerror）一律丢弃，白名单标签保留', () => {
    expect(safeHtml('<b onmouseover="alert(1)" class="x">hi</b>')).toBe('<b>hi</b>')
    expect(safeHtml('<p onclick="alert(1)">p</p>')).toBe('<p>p</p>')
  })

  it('非 span 标签的 style 也被丢弃（仅 span 白名单）', () => {
    expect(safeHtml('<p style="color:red">p</p>')).toBe('<p>p</p>')
    expect(safeHtml('<b style="color:red">b</b>')).toBe('<b>b</b>')
  })

  it('span 单引号 style 归一化为双引号输出', () => {
    expect(safeHtml("<span style='color:red'>x</span>")).toBe('<span style="color:red">x</span>')
  })

  it('style 含 javascript:（大小写混写）被剥除', () => {
    expect(safeHtml('<span style="color:red;JAVASCRIPT:alert(1)">x</span>')).toBe('<span>x</span>')
    expect(safeHtml('<span style="JaVaScRiPt:alert(1)">x</span>')).toBe('<span>x</span>')
  })

  it('style 中数字实体编码混淆的 javascript: 被解码后识别并剥除', () => {
    expect(safeHtml('<span style="background:url(&#x6a;avascript:alert(1))">x</span>')).toBe('<span>x</span>')
    expect(safeHtml('<span style="background:url(jav&#97;script:alert(1))">x</span>')).toBe('<span>x</span>')
  })

  it('style 中 expression() 与 behavior: 被剥除（老式 IE 执行向量）', () => {
    expect(safeHtml('<span style="width:expression(alert(1))">x</span>')).toBe('<span>x</span>')
    expect(safeHtml('<span style="BEHAVIOR:url(#default#time2)">x</span>')).toBe('<span>x</span>')
  })

  it('合法 style（含大写属性名）保留，不误伤', () => {
    expect(safeHtml('<span style="COLOR:red">x</span>')).toBe('<span style="COLOR:red">x</span>')
    expect(safeHtml('<span style="text-decoration:underline">x</span>')).toBe(
      '<span style="text-decoration:underline">x</span>'
    )
  })

  it('属性值内的 > 不会被当作标签结束（属性注入不产生新标签）', () => {
    expect(safeHtml('<b title="x>y">t</b>')).toBe('<b>t</b>')
  })

  it('嵌套/畸形 script 写法不残留可执行 script 起始标签', () => {
    expect(safeHtml('<scr<script>ipt>alert(1)</script>tail')).not.toContain('<script')
    expect(safeHtml('<script>alert(1)')).not.toContain('<script')
  })

  it('白名单标签嵌套正常保留', () => {
    expect(safeHtml('<p><b><em>nested</em></b></p>')).toBe('<p><b><em>nested</em></b></p>')
  })

  it('净化具备幂等性（二次净化结果一致）', () => {
    const payload = '<b>a</b><span style="color:red">b</span><script>x</script><a href="javascript:1">c</a>'
    const once = safeHtml(payload)
    expect(safeHtml(once)).toBe(once)
  })
})