/**
 * 前端数据类型定义 · Frontend data type definitions
 *
 * @description
 * API 返回双语（Bilingual*）结构：`{ zh, en }` 形式的字段，前端一次拉取后按当前语言本地化显示，
 * 语言切换时只切换文案（computed 重算），无需重新请求 API。
 */

/** 双语文本对 · Bilingual text pair */
export interface BilingualText {
  zh: string;
  en: string;
}

/** 双语演唱会 · Bilingual concert (API 返回) */
export interface BilingualConcert {
  id: number;
  artist: BilingualText;
  concertName: BilingualText;
  theme: BilingualText;
  location: BilingualText;
  locationDetail: {
    country: BilingualText;
    province: BilingualText;
    city: BilingualText;
    venue: BilingualText;
  };
  seat: BilingualText | null;
  price: BilingualText | null;
  date: string;
  time: string | null;
  poster: string | null;
  tags: { zh: string[]; en: string[] };
  description: BilingualText;
  images: { src: string; alt: BilingualText }[];
  video: BilingualText | null;
  videoUrl: BilingualText | null;
  songlist: { zh: string; en: string; link: string | null }[];
}

/** 双语城市 · Bilingual city (API 返回) */
export interface BilingualCity {
  id: number;
  name: BilingualText;
  icon: string | null;
  concerts: number;
}

/** 双语许愿 · Bilingual wish (API 返回) */
export interface BilingualWish {
  id: number;
  content: BilingualText;
  time: string;
  likes: number;
  liked: boolean;
}

/** 演唱会（单语言本地化结果）· Concert (localized) */
export interface Concert {
  id: number;
  artist: string;
  concertName: string;
  theme: string;
  location: string;
  seat: string | null;
  price: string | null;
  date: string;
  time: string | null;
  poster: string | null;
  tags: string[];
  description: string;
  images: { src: string; alt: string }[];
  video: string | null;
  videoUrl: string | null;
  songlist: SongItem[];
}

/** 城市（单语言本地化结果）· City (localized) */
export interface City {
  id: number;
  name: string;
  icon: string | null;
  concerts: number;
}

/** 许愿（单语言本地化结果）· Wish (localized) */
export interface Wish {
  id: number;
  content: string;
  time: string;
  likes: number;
  liked: boolean;
}

/** 歌单条目（单语言本地化结果）· Songlist item (localized) */
export interface SongItem {
  name: string;
  link: string | null;
}

/** 统计信息 · Stats */
export interface Stats {
  totalConcerts: number;
  totalArtists: number;
  totalCities: number;
}

/** 全量应用数据（/api/data 返回）· App data payload */
export interface AppData {
  concerts: BilingualConcert[];
  cities: BilingualCity[];
  wishes: BilingualWish[];
  stats: Stats;
}

/** 语言类型 · Language */
export type Lang = 'zh' | 'en';
