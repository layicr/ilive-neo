/**
 * 留言板领域模型 · Guestbook models
 * @module types/guestbook
 * @description 访客留言板的主留言与回复结构，以及分页结果。用户生成内容（UGC）为单语言文本，
 *              不采用 *_i18n JSON（与演唱会/许愿的多语言模型不同）。邮箱字段仅入库、不对外暴露。
 */

/** 单条回复 · A single reply */
export interface GuestbookReply {
  /** 回复编号 · reply id */
  id: number
  /** 关联主留言编号 · parent message id */
  guestbookId: number
  /** 昵称 · nickname */
  nickname: string
  /** 回复内容（支持 emoji）· reply content (emoji-friendly) */
  content: string
  /** 浏览器（服务端解析 UA）· browser (parsed from UA) */
  browser: string | null
  /** 操作系统 · operating system */
  os: string | null
  /** 创建时间 · created at */
  createdAt: string
}

/** 主留言（含其已通过回复）· A guestbook message (with its approved replies) */
export interface GuestbookMessage {
  /** 留言编号 · message id */
  id: number
  /** 昵称 · nickname */
  nickname: string
  /** 留言内容（支持 emoji）· content (emoji-friendly) */
  content: string
  /** 浏览器（服务端解析 UA）· browser (parsed from UA) */
  browser: string | null
  /** 操作系统 · operating system */
  os: string | null
  /** 创建时间 · created at */
  createdAt: string
  /** 已通过的回复列表 · approved replies */
  replies: GuestbookReply[]
}

/** 分页结果 · Paginated result */
export interface GuestbookPage {
  /** 当前页主留言 · messages on this page */
  messages: GuestbookMessage[]
  /** 当前页码（从 1 开始）· current page (1-based) */
  page: number
  /** 每页条数 · page size */
  pageSize: number
  /** 总页数 · total pages */
  totalPages: number
  /** 已通过留言总数 · total approved messages */
  total: number
}
