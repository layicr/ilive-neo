/**
 * 票根模态框 composable · Ticket modal
 *
 * @description 从 main.js 的 initTicketModal 迁移而来。
 *              纯状态管理：点击「场次」统计卡片打开票根展示模态框，渲染交给模板（声明式）。
 */
import { useSharedState } from './useSharedState'

function getTicketModalOpen() {
  return useSharedState<boolean>('ticket:open', () => false)
}

/** 打开票根模态框 · Open ticket modal */
function openTicketModal(): void {
  const ticketModalOpen = getTicketModalOpen()
  ticketModalOpen.value = true
}

/** 关闭票根模态框 · Close ticket modal */
function closeTicketModal(): void {
  const ticketModalOpen = getTicketModalOpen()
  ticketModalOpen.value = false
}

/**
 * useTicketModal 组合式入口 · Composable entry
 */
export function useTicketModal() {
  const ticketModalOpen = getTicketModalOpen()

  return {
    ticketModalOpen,
    openTicketModal,
    closeTicketModal
  }
}
