/**
 * 演唱会领域模型 · Concert models
 * @module types/concert
 * @description `Concert` 为前端本地化后的单语言形态；`LocalizedConcert` 为 DB 原始
 *              多语言形态（mappers 产出），前端按当前 locale 取词。
 */

import type { LocalizedText, LocalizedTags } from './i18n'

/** 歌曲条目 · Song entry（歌名 + 可选试听/视频链接） */
export interface SongItem {
  /** 歌曲名 · song name */
  name: string
  /** 外部链接（可空）· external link (nullable) */
  link: string | null
}

/** 单语言演唱会（前端按 locale 本地化后的展示形态）· Single-locale concert (view shape after localization) */
export interface Concert {
  id: number
  artist: string
  concertName: string
  theme: string
  location: string
  locationDetail: { country: string; province: string; city: string; venue: string }
  seat: string | null
  price: string | null
  date: string
  time: string | null
  poster: string | null
  tags: string[]
  description: string
  images: { src: string; alt: string }[]
  video: string | null
  videoUrl: string | null
  songlist: SongItem[]
  /** 点赞总数（由 concert_likes 统计）· total likes */
  likes: number
  /** 当前访问者是否已点赞 · whether the current visitor has liked */
  liked: boolean
}

/** 多语言演唱会（DB 原始形态，按 locale 分组）· Multi-locale concert (DB shape) */
export interface LocalizedConcert {
  id: number
  artist: LocalizedText
  concertName: LocalizedText
  theme: LocalizedText
  location: LocalizedText
  locationDetail: { country: LocalizedText; province: LocalizedText; city: LocalizedText; venue: LocalizedText }
  seat: LocalizedText | null
  price: LocalizedText | null
  date: string
  time: string | null
  poster: string | null
  tags: LocalizedTags
  description: LocalizedText
  images: { src: string; alt: LocalizedText }[]
  video: LocalizedText | null
  videoUrl: LocalizedText | null
  songlist: { name: LocalizedText; link: string | null }[]
  /** 点赞总数（由 concert_likes 统计）· total likes */
  likes: number
  /** 当前访问者是否已点赞（按请求 IP 合并）· whether the current visitor has liked */
  liked: boolean
}
