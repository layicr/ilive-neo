/**
 * countUniqueArtists —— 艺人总数统计（按 zh-CN 维度，歌手 + 团队并集、「、」拆分）
 *
 * @description 覆盖 `server/lib/concerts.ts` 的 `countUniqueArtists`：
 *              `artist_i18n`（歌手）与 `team_i18n`（团队成员）都可能以中文顿号「、」包含多个名字，
 *              统计时两者均拆分、trim、去空后取并集跨场次去重计数。
 *              对应 `server/api/data.get.ts` 的 `stats.totalArtists` 计算。
 */
import { describe, it, expect } from 'vitest'
import { countUniqueArtists } from '../../server/lib/mappers'

/** 构造最小输入（含统计所需的 artist / team 的 zh-CN）· minimal input for the stats */
function rows(artistsZh: (string | null | undefined)[]): { artist: { 'zh-CN'?: string } }[] {
  return artistsZh.map((zh) => ({ artist: { 'zh-CN': zh ?? undefined } }))
}

describe('countUniqueArtists · 单歌手（无拆分）', () => {
  it('每场一个歌手、互不相同 → 等于场次', () => {
    expect(countUniqueArtists(rows(['五月天', '周杰伦', '孙燕姿']))).toBe(3)
  })

  it('空数组 → 0', () => {
    expect(countUniqueArtists(rows([]))).toBe(0)
  })
})

describe('countUniqueArtists · 多歌手（「、」拆分）', () => {
  it('单场内并列两个歌手 → 计 2', () => {
    expect(countUniqueArtists(rows(['五月天、任贤齐']))).toBe(2)
  })

  it('顿号周围带空格 → trim 后正确拆分', () => {
    expect(countUniqueArtists(rows([' 五月天 、 任贤齐 ']))).toBe(2)
  })

  it('三个歌手 + 末尾多余顿号 → 不计入空串', () => {
    expect(countUniqueArtists(rows(['阿信、怪兽、石头、']))).toBe(3)
  })

  it('跨场次多歌手混合 → 全部拆分后去重', () => {
    // 场次1: 五月天、任贤齐(2) | 场次2: 周杰伦(1) | 场次3: 任贤齐、孙燕姿(2, 任贤齐重复)
    // 去重后: 五月天/任贤齐/周杰伦/孙燕姿 = 4
    const res = countUniqueArtists(rows(['五月天、任贤齐', '周杰伦', '任贤齐、孙燕姿']))
    expect(res).toBe(4)
  })
})

describe('countUniqueArtists · 歌手 + 团队并集去重', () => {
  it('团队成员并入歌手集合（五月天 + 五位成员 = 6）', () => {
    const rowsWithTeam = [{
      artist: { 'zh-CN': '五月天' },
      team: { 'zh-CN': '阿信、怪兽、石头、玛莎、冠佑' }
    }]
    expect(countUniqueArtists(rowsWithTeam)).toBe(6)
  })

  it('团队与歌手重复时只计一次', () => {
    const rowsWithTeam = [{
      artist: { 'zh-CN': '张韶涵、阿杜' },
      team: { 'zh-CN': '张韶涵、阿杜' }
    }]
    expect(countUniqueArtists(rowsWithTeam)).toBe(2)
  })

  it('team 缺失 / 空串时退化为仅统计歌手', () => {
    const rowsWithTeam = [
      { artist: { 'zh-CN': '周杰伦' }, team: { 'zh-CN': '' } },
      { artist: { 'zh-CN': '蔡依林' } }
    ]
    expect(countUniqueArtists(rowsWithTeam)).toBe(2)
  })
})

describe('countUniqueArtists · 去重与容错', () => {
  it('同歌手跨多场重复 → 只计 1', () => {
    expect(countUniqueArtists(rows(['五月天', '五月天', '五月天']))).toBe(1)
  })

  it('artist 缺失 / 空串 / null / undefined → 跳过不计入', () => {
    expect(countUniqueArtists(rows([null, undefined, '', '   ']))).toBe(0)
  })

  it('有歌手场次与空场次混合 → 只数有效歌手', () => {
    expect(countUniqueArtists(rows(['五月天', null, '周杰伦', '']))).toBe(2)
  })

  it('仅去除首尾空白、不额外归一化（不同写法视为不同歌手）', () => {
    // '五月天 '(尾随空格) 经 trim 归并为「五月天」；'Mayday' 为另一写法 → 计 2
    expect(countUniqueArtists(rows(['五月天', '五月天 ', 'Mayday']))).toBe(2)
  })
})
