<script setup lang="ts">
/**
 * 留言板 · Guestbook
 * @description 数据来自 useGuestbook（useState 共享，onMounted 拉取）；
 *              主留言/回复表单、emoji 面板、回复分页为局部状态。
 */
import { onMounted, reactive, ref } from 'vue'
import { useGuestbook } from '~/composables/useGuestbook'
import { useAppI18n } from '~/composables/useI18n'
import { formatWishDate } from '~/utils'

const {
  messages: gbMessages,
  page: gbPage,
  totalPages: gbTotalPages,
  loading: gbLoading,
  error: gbError,
  view: gbView,
  fetchMessages,
  postMessage,
  postReply,
  setView,
  prevPage,
  nextPage
} = useGuestbook()
const { currentData } = useAppI18n()
/** vue-i18n 原始 t（参数化插值，自动导入）· raw t */
const { t } = useI18n()

// 主留言表单 · message form
const gbForm = reactive({ nickname: '', email: '', content: '' })
const gbFormError = ref('')

// 邮箱格式：与服务端一致的基础校验（避免依赖浏览器原生校验气泡）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 回复表单（同一时刻仅一条打开）· reply form (one open at a time)
const replyOpenId = ref<number | null>(null)
const replyForm = reactive({ nickname: '', email: '', content: '' })
const replyError = ref('')

// 回复分页：默认显示 3 条，点「更多」每次再显示 10 条
const REPLY_INITIAL = 3
const REPLY_STEP = 10
const replyLimits = reactive<Record<number, number>>({})
function replyLimit(id: number): number {
  return replyLimits[id] ?? REPLY_INITIAL
}
function showMoreReplies(id: number): void {
  replyLimits[id] = replyLimit(id) + REPLY_STEP
}

// emoji 面板 · emoji panel（点击插入到当前聚焦的输入框）
const EMOJI_LIST = ['😀', '😁', '😂', '🤣', '😊', '😉', '😍', '🥰', '😎', '🤗', '😶', '🙃', '🤔', '👍', '👌', '🎉', '✨', '💯', '❤️', '🔥']
const emojiPanelOpen = ref(false)
const emojiTarget = ref<'content' | 'reply'>('content')
function toggleEmojiPanel(target: 'content' | 'reply'): void {
  if (emojiPanelOpen.value && emojiTarget.value === target) {
    emojiPanelOpen.value = false
    return
  }
  emojiTarget.value = target
  emojiPanelOpen.value = true
}
function insertEmoji(e: string): void {
  if (emojiTarget.value === 'content') gbForm.content += e
  else replyForm.content += e
  emojiPanelOpen.value = false
}

function toggleReply(id: number): void {
  emojiPanelOpen.value = false
  if (replyOpenId.value === id) {
    replyOpenId.value = null
    return
  }
  replyOpenId.value = id
  replyForm.nickname = ''
  replyForm.email = ''
  replyForm.content = ''
  replyError.value = ''
}

// 接口错误 → 友好文案 · map API error to a friendly message
function resolveGuestbookError(e: any): string {
  if (e?.status === 429) return t('errorMessages.rateLimited')
  if (e?.status === 400 && e?.data?.error) return String(e.data.error)
  return t('errorMessages.generic')
}

async function submitMessage(): Promise<void> {
  gbFormError.value = ''
  const nickname = gbForm.nickname.trim()
  const email = gbForm.email.trim()
  const content = gbForm.content.trim()
  if (!nickname || !email || !content) {
    gbFormError.value = t('guestbook.required')
    return
  }
  if (!EMAIL_RE.test(email)) {
    gbFormError.value = t('guestbook.invalidEmail')
    return
  }
  try {
    await postMessage({ nickname, email, content })
    gbForm.nickname = ''
    gbForm.email = ''
    gbForm.content = ''
    emojiPanelOpen.value = false
  } catch (e: any) {
    gbFormError.value = resolveGuestbookError(e)
  }
}

async function submitReply(id: number): Promise<void> {
  replyError.value = ''
  const nickname = replyForm.nickname.trim()
  const email = replyForm.email.trim()
  const content = replyForm.content.trim()
  if (!nickname || !email || !content) {
    replyError.value = t('guestbook.required')
    return
  }
  if (!EMAIL_RE.test(email)) {
    replyError.value = t('guestbook.invalidEmail')
    return
  }
  try {
    await postReply({ guestbookId: id, nickname, email, content })
    replyOpenId.value = null
  } catch (e: any) {
    replyError.value = resolveGuestbookError(e)
  }
}

onMounted(() => {
  void fetchMessages()
})
</script>

<template>
  <section class="guestbook-section" id="guestbookSection">
    <div class="gb-header">
      <h2 class="gb-title">{{ currentData.guestbook.title }}</h2>
    </div>

    <!-- 提交卡片 · submit card -->
    <form class="gb-submit-card" novalidate @submit.prevent="submitMessage">
      <div class="gb-form-row">
        <input class="gb-input" type="text" v-model="gbForm.nickname" :placeholder="currentData.guestbook.nicknamePlaceholder" maxlength="40" />
        <input class="gb-input" type="email" v-model="gbForm.email" :placeholder="currentData.guestbook.emailPlaceholder" maxlength="120" />
        <input class="gb-input gb-input-content" type="text" v-model="gbForm.content" :placeholder="currentData.guestbook.contentPlaceholder" maxlength="1000" />
        <button type="button" class="gb-emoji-btn" @click="toggleEmojiPanel('content')" aria-label="emoji">😊</button>
        <button type="submit" class="gb-btn">{{ currentData.guestbook.publish }}</button>
      </div>
      <div class="gb-emoji-panel" :class="{ show: emojiPanelOpen && emojiTarget === 'content' }">
        <span class="gb-emoji-item" v-for="e in EMOJI_LIST" :key="e" @click="insertEmoji(e)">{{ e }}</span>
      </div>
      <p v-if="gbFormError" class="gb-form-error">{{ gbFormError }}</p>
    </form>

    <!-- 工具栏：视图切换 · toolbar -->
    <div class="gb-toolbar">
      <div class="gb-view-switch">
        <button type="button" :class="{ active: gbView === 'card' }" @click="setView('card')">{{ currentData.guestbook.viewCard }}</button>
        <button type="button" :class="{ active: gbView === 'list' }" @click="setView('list')">{{ currentData.guestbook.viewList }}</button>
      </div>
    </div>

    <!-- 加载 / 错误 / 空态 · loading / error / empty -->
    <div v-if="gbLoading" class="gb-status">{{ currentData.status.loading }}</div>
    <div v-else-if="gbError" class="gb-status gb-status-error">{{ currentData.errorMessages.loadFailed }}</div>
    <div v-else-if="gbMessages.length === 0" class="gb-empty">{{ currentData.guestbook.empty }}</div>

    <template v-else>
      <div class="gb-wall" :class="gbView === 'card' ? 'gb-card-wall' : 'gb-list-view'">
        <article class="gb-message-card" v-for="m in gbMessages" :key="m.id" :data-gid="m.id">
          <p class="gb-message-text">{{ m.content }}</p>
          <div class="gb-message-meta">
            <div class="gb-meta-row">
              <span>{{ m.nickname }}</span>
              <span>{{ formatWishDate(m.createdAt) }}</span>
            </div>
            <div class="gb-meta-row" v-if="m.browser || m.os">
              <span v-if="m.browser">🌐 {{ m.browser }}</span>
              <span v-if="m.os">💻 {{ m.os }}</span>
            </div>
          </div>
          <button type="button" class="gb-btn gb-btn-ghost gb-btn-sm gb-reply-toggle" @click="toggleReply(m.id)">{{ currentData.guestbook.reply }}</button>

          <div class="gb-reply-list" v-if="m.replies.length">
            <div class="gb-reply-item" v-for="r in m.replies.slice(0, replyLimit(m.id))" :key="r.id">
              <div class="gb-reply-content">{{ r.content }}</div>
              <div class="gb-reply-meta">
                <span>{{ r.nickname }}</span>
                <span>{{ formatWishDate(r.createdAt) }}<template v-if="r.browser || r.os"> · 🌐{{ r.browser }} 💻{{ r.os }}</template></span>
              </div>
            </div>
            <button
              v-if="m.replies.length > replyLimit(m.id)"
              type="button"
              class="gb-btn gb-btn-ghost gb-btn-sm gb-reply-more"
              @click="showMoreReplies(m.id)"
            >{{ currentData.guestbook.more }}</button>
          </div>

          <div class="gb-reply-form" :class="{ show: replyOpenId === m.id }">
            <input class="gb-input-sm" type="text" v-model="replyForm.nickname" :placeholder="currentData.guestbook.replyNicknamePlaceholder" maxlength="40" />
            <input class="gb-input-sm" type="email" v-model="replyForm.email" :placeholder="currentData.guestbook.replyEmailPlaceholder" maxlength="120" />
            <input class="gb-input-sm" type="text" v-model="replyForm.content" :placeholder="currentData.guestbook.replyContentPlaceholder" maxlength="1000" />
            <button type="button" class="gb-emoji-btn" @click="toggleEmojiPanel('reply')" aria-label="emoji">😊</button>
            <button type="button" class="gb-btn gb-btn-sm" @click="submitReply(m.id)">{{ currentData.guestbook.replySubmit }}</button>
            <p v-if="replyOpenId === m.id && replyError" class="gb-form-error gb-form-error--inline">{{ replyError }}</p>
            <div class="gb-emoji-panel" :class="{ show: emojiPanelOpen && emojiTarget === 'reply' }">
              <span class="gb-emoji-item" v-for="e in EMOJI_LIST" :key="e" @click="insertEmoji(e)">{{ e }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- 分页 · pagination -->
      <div class="gb-pagination">
        <button type="button" class="gb-btn gb-btn-ghost" @click="prevPage" :disabled="gbPage <= 1">{{ currentData.guestbook.prev }}</button>
        <div class="gb-page-info">{{ gbPage }} / {{ gbTotalPages }}</div>
        <button type="button" class="gb-btn" @click="nextPage" :disabled="gbPage >= gbTotalPages">{{ currentData.guestbook.next }}</button>
      </div>
    </template>
  </section>
</template>
