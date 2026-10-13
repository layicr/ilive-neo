<script setup lang="ts">
/**
 * 票根模态 · Ticket modal
 * @description 列表用 @tanstack/vue-virtual 按行窗口化渲染，避免一次性渲染全部卡片；
 *              打开态与数据来自共享 composable，无需 props 透传。
 */
import { onMounted, onUnmounted, watch, nextTick, ref, computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useTicketModal } from '~/composables/useTicketModal'
import { useTimeline } from '~/composables/useTimeline'
import { useAppI18n } from '~/composables/useI18n'
import { thumbSrc, onThumbError } from '~/utils/thumb'

const { ticketModalOpen, closeTicketModal } = useTicketModal()
const { sortedConcerts } = useTimeline()
const { currentData } = useAppI18n()

const ticketContainerRef = ref<HTMLElement | null>(null)
const ticketModalContentRef = ref<HTMLElement | null>(null)
const CARD_MIN = 280
function currentGap(): number {
  return typeof window !== 'undefined' && window.innerWidth <= 768 ? 20 : 30
}
const columns = ref(1)
const rowHeight = ref(650)
function computeColumns(): void {
  const el = ticketContainerRef.value
  if (!el) return
  const w = el.clientWidth
  if (w <= 0) return
  const gap = currentGap()
  columns.value = Math.max(1, Math.floor((w + gap) / (CARD_MIN + gap)))
}
function computeRowHeight(): void {
  // estimateSize 仅作首屏估算，真实高度由动态测量修正
  rowHeight.value = typeof window !== 'undefined' && window.innerWidth <= 768 ? 560 : 700
}
const rowCount = computed(() => Math.ceil(sortedConcerts.value.length / Math.max(1, columns.value)))
// 行间距：卡片高度随内容浮动（约 660–720px），固定 estimateSize 会导致行重叠。
// 故交给虚拟器动态测量每行真实高度，再叠加固定的上下行间距 ROW_GAP。
// Row gap: card height varies with content, so let the virtualizer measure each row
// dynamically and add a fixed ROW_GAP between rows (prevents overlap).
const ROW_GAP = 56
/**
 * ⚠️ options 必须**整体包成 computed** 传入。
 * 库内部实现是 `computed(() => ({ ...defaults, ...unref(options) }))`：
 * 若传普通对象，`count: rowCount.value` 会在 setup 期就被求值成**静态数字**，之后 `rowCount`
 * 变化不会触发 `setOptions`，count 被钉死在 setup 时刻的值。
 * 语言切换会重建页面组件，而新语言数据在 setup 之后才到达 —— 此时 count 为 0 且永不更新，
 * 表现为「切换语言后打开票根模态空白」。包成 computed 后，数据就绪 / 列数变化都会重新求值。
 * 注意：`count` 本身仍必须是**数字**（传函数会让库内部 `new Array(count)` 得到 NaN 并抛
 * RangeError），响应式由外层 computed 提供。
 * Options must be wrapped in a computed; `count` stays a plain number (a function breaks the lib).
 */
const virtualizer = useVirtualizer(computed(() => ({
  count: rowCount.value,
  getScrollElement: () => ticketModalContentRef.value,
  estimateSize: () => rowHeight.value,
  overscan: 4,
  gap: ROW_GAP,
})))
/** 动态测量每一行真实高度 · measure the real height of each rendered row */
function setTicketRowRef(el: Element | ComponentPublicInstance | null): void {
  virtualizer.value?.measureElement(el as HTMLElement | null)
}
function rowItems(rowIndex: number): { concert: (typeof sortedConcerts.value)[number]; index: number }[] {
  const cols = Math.max(1, columns.value)
  const start = rowIndex * cols
  return sortedConcerts.value
    .slice(start, start + cols)
    .map((c, i) => ({ concert: c, index: start + i }))
}
let ticketResizeObserver: ResizeObserver | null = null
onMounted(() => {
  computeColumns()
  computeRowHeight()
  if (typeof window !== 'undefined' && 'ResizeObserver' in window && ticketModalContentRef.value) {
    ticketResizeObserver = new ResizeObserver(() => {
      computeColumns()
      computeRowHeight()
    })
    ticketResizeObserver.observe(ticketModalContentRef.value)
  }
})
onUnmounted(() => {
  ticketResizeObserver?.disconnect()
})
// 打开模态框时容器尺寸从 0 变化，强制重算列数/行高并刷新虚拟器
// 注意：useVirtualizer 返回的是 ref，需通过 .value 访问实例方法
// When the modal opens, the container resizes from 0; recompute columns/row height and refresh the virtualizer.
watch(ticketModalOpen, (open) => {
  if (open) {
    nextTick(() => {
      computeColumns()
      computeRowHeight()
      virtualizer.value?.measure()
    })
  }
})
</script>

<template>
  <div class="ticket-modal" id="ticketModal" role="dialog" aria-modal="true" aria-label="演唱会票根展示" :class="{ active: ticketModalOpen }">
    <div class="ticket-modal-overlay" id="ticketModalOverlay" @click="closeTicketModal"></div>
    <div class="ticket-modal-content" ref="ticketModalContentRef">
      <div class="ticket-modal-header">
        <h2 class="ticket-modal-title" id="ticketModalTitle">{{ currentData.ticketModalTitle }}</h2>
        <button class="ticket-close" id="closeTicketModal" aria-label="关闭票根展示" @click="closeTicketModal">&times;</button>
      </div>
      <div class="ticket-container" id="ticketContainer" ref="ticketContainerRef">
        <div class="ticket-virtual-sizer" :style="{ height: virtualizer.getTotalSize() + 'px' }">
          <div
            v-for="row in virtualizer.getVirtualItems()"
            :key="row.index"
            :data-index="row.index"
            :ref="setTicketRowRef"
            class="ticket-virtual-row"
            :style="{ transform: `translateY(${row.start}px)` }"
          >
            <div
              v-for="item in rowItems(row.index)"
              :key="item.concert.id"
              class="ticket-card"
              :class="'ticket-hue-' + (item.index % 6)"
            >
              <img
                class="ticket-poster"
                :src="thumbSrc(item.concert.poster || 'img/logo.jpg')"
                :alt="item.concert.concertName"
                decoding="async"
                @error="onThumbError($event, item.concert.poster || 'img/logo.jpg')"
              />
              <div class="ticket-content">
                <div class="ticket-artist">{{ item.concert.artist }}</div>
                <div class="ticket-concert">{{ item.concert.concertName }}</div>
                <div class="ticket-divider"></div>
                <div class="ticket-info">
                  <div class="ticket-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>{{ item.concert.date }}{{ item.concert.time ? ' ' + item.concert.time : '' }}</span>
                  </div>
                  <div class="ticket-info-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>{{ item.concert.location }}</span>
                  </div>
                  <div v-if="item.concert.seat || item.concert.price" class="ticket-info-item ticket-seat-price">
                    <span v-if="item.concert.seat" class="ticket-seat">
                      <i class="fas fa-chair"></i>
                      {{ item.concert.seat }}
                    </span>
                    <span v-if="item.concert.seat && item.concert.price" class="ticket-separator">|</span>
                    <span v-if="item.concert.price" class="ticket-price">
                      <i class="fas fa-ticket-alt"></i>
                      {{ item.concert.price }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
