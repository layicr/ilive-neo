// 缩略图工具 · Thumbnail helpers
// 从 index.vue 抽出，供 3D 封面 / 票根 / 画廊统一复用（DRY）。
// Thumbnail helpers shared by the 3D album cover, ticket cards and gallery.

/** 缩略图地址 · thumbnail src（xxx.jpg -> xxx_thumb.jpg） */
export function thumbSrc(src: string): string {
  return src.replace('.jpg', '_thumb.jpg')
}

/** 图片加载失败回退到原图 · fallback to full image on error */
export function onThumbError(event: Event, src: string): void {
  const img = event.target as HTMLImageElement | null
  if (img) {
    img.src = src
    img.onerror = null
  }
}
