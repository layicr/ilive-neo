/**
 * splitArtistNames —— 拼盘艺人名拆分（前端纯函数）
 *
 * @description 与服务端 `countUniqueArtists` 同口径：顿号「、」拆分 → trim → 去空。
 *              艺人列表弹窗按拆分后的独立艺人行展示，场次计数一一对应。
 */
import { describe, it, expect } from 'vitest'
import { aggregateArtistShows, splitArtistNames } from '../../app/utils'

describe('splitArtistNames · 拆分拼盘艺人', () => {
  it('单歌手原样返回', () => {
    expect(splitArtistNames('周杰伦')).toEqual(['周杰伦'])
  })

  it('顿号拆分多歌手', () => {
    expect(splitArtistNames('五月天、任贤齐')).toEqual(['五月天', '任贤齐'])
  })

  it('顿号周围带空格 → trim 后拆分', () => {
    expect(splitArtistNames(' 五月天 、 任贤齐 ')).toEqual(['五月天', '任贤齐'])
  })

  it('末尾顿号 → 不计入空串', () => {
    expect(splitArtistNames('阿信、怪兽、')).toEqual(['阿信', '怪兽'])
  })

  it('空串 / null / undefined → 空数组', () => {
    expect(splitArtistNames('')).toEqual([])
    expect(splitArtistNames(null)).toEqual([])
    expect(splitArtistNames(undefined)).toEqual([])
  })
})

describe('aggregateArtistShows · 艺人弹窗场数按场次去重', () => {
  it('单人歌手的 team 等于 artist 时只计 1 场（不重复）', () => {
    expect(aggregateArtistShows([
      { artist: '周杰伦', team: '周杰伦' }
    ])).toEqual([{ name: '周杰伦', count: 1 }])
  })

  it('团队成员与歌手不同名时分别计场，且同一成员跨场累加', () => {
    const result = aggregateArtistShows([
      { artist: '五月天', team: '阿信、怪兽、石头、玛莎、冠佑' },
      { artist: 'F✦FOREVER', team: '言承旭、周渝民、吴建豪、阿信' },
      { artist: '阿信', team: '阿信' }
    ])
    expect(result.find((x) => x.name === '阿信')?.count).toBe(3)
    expect(result.find((x) => x.name === '五月天')?.count).toBe(1)
    expect(result.find((x) => x.name === '怪兽')?.count).toBe(1)
  })

  it('team 缺失时退化为仅按 artist 计场', () => {
    expect(aggregateArtistShows([
      { artist: '梁静茹' },
      { artist: '梁静茹', team: '' }
    ])).toEqual([{ name: '梁静茹', count: 2 }])
  })
})
