/**
 * 单元测试：server/lib/parse.ts — 多语言 JSON 列解析
 *
 * @description 覆盖 parseI18n / parseTags / has 的正常、缺键、遗留语言键、非法输入与
 *              「绝不抛错」约束。mappers.test.ts 只从 mapConcert 间接覆盖，此处直测边界。
 *
 *              Direct boundary coverage for parseI18n / parseTags / has (never throw).
 */
import { describe, it, expect } from 'vitest'
import { parseI18n, parseTags, has } from '../../server/lib/parse'

describe('parseI18n — 多语言文本列', () => {
  it('正常 JSON：解析各语言并保留原键', () => {
    const out = parseI18n('{"zh-CN":"你好","en":"Hello","zh-Hant":"哈囉"}')
    expect(out['zh-CN']).toBe('你好')
    expect(out.en).toBe('Hello')
    expect(out['zh-Hant']).toBe('哈囉')
  })

  it('缺少 zh-CN：自动补空串（zh-CN 为基语言）', () => {
    const out = parseI18n('{"en":"Hello"}')
    expect(out['zh-CN']).toBe('')
    expect(out.en).toBe('Hello')
  })

  it('历史库遗留的已下线语言键（ja / ko）原样保留、不参与展示也不抛错', () => {
    const out = parseI18n('{"zh-CN":"中文","ja":"日本語","ko":"한국어"}')
    expect(out['zh-CN']).toBe('中文')
    expect((out as Record<string, string>).ja).toBe('日本語')
    expect((out as Record<string, string>).ko).toBe('한국어')
  })

  it('null / undefined / 空串 → { "zh-CN": "" }', () => {
    expect(parseI18n(null)).toEqual({ 'zh-CN': '' })
    expect(parseI18n(undefined)).toEqual({ 'zh-CN': '' })
    expect(parseI18n('')).toEqual({ 'zh-CN': '' })
  })

  it('非法 JSON / JSON 标量 / 数组都不抛错，回退 { "zh-CN": "" }', () => {
    expect(parseI18n('{not json')).toEqual({ 'zh-CN': '' })
    expect(parseI18n('123')).toEqual({ 'zh-CN': '' })
    expect(parseI18n('null')).toEqual({ 'zh-CN': '' })
    expect(parseI18n('[1,2]')).toEqual({ 'zh-CN': '' })
  })

  it('键存在但值为 null 时补空串（?? 兜底）', () => {
    const out = parseI18n('{"zh-CN":null,"en":"Hello"}')
    expect(out['zh-CN']).toBe('')
  })
})

describe('parseTags — 多语言标签数组列', () => {
  it('正常 JSON 数组：各语言数组可用', () => {
    const out = parseTags('{"zh-CN":["摇滚","现场"],"en":["Rock","Live"]}')
    expect(out['zh-CN']).toEqual(['摇滚', '现场'])
    expect(out.en).toEqual(['Rock', 'Live'])
  })

  it('缺少 zh-CN：补空数组', () => {
    const out = parseTags('{"en":["Rock"]}')
    expect(out['zh-CN']).toEqual([])
    expect(out.en).toEqual(['Rock'])
  })

  it('null / undefined / 空串 / 非法 JSON → { "zh-CN": [] }', () => {
    expect(parseTags(null)).toEqual({ 'zh-CN': [] })
    expect(parseTags(undefined)).toEqual({ 'zh-CN': [] })
    expect(parseTags('')).toEqual({ 'zh-CN': [] })
    expect(parseTags('oops')).toEqual({ 'zh-CN': [] })
  })

  it('zh-CN 值不是数组时兜底为空数组（脏数据防护）', () => {
    const out = parseTags('{"zh-CN":"not-an-array","en":["Rock"]}')
    expect(out['zh-CN']).toEqual([])
    expect(out.en).toEqual(['Rock'])
  })
})

describe('has — 非 null 类型守卫', () => {
  it('null / undefined → false', () => {
    expect(has(null)).toBe(false)
    expect(has(undefined)).toBe(false)
  })

  it('字符串（含空串）→ true（仅判非 null，空串由调用方 trim 兜底）', () => {
    expect(has('')).toBe(true)
    expect(has('x')).toBe(true)
  })
})
