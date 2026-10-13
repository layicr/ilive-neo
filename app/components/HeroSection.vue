<script setup lang="ts">
/** Hero / 个人资料区 · Hero + profile（role 文本由 currentData + stats 派生，点击平滑滚动到对应锚点） */
import { useData } from '~/composables/useData'
import { useAppI18n } from '~/composables/useI18n'

const { stats } = useData()
const { currentData } = useAppI18n()

/** 三项 role 的点击滚动目标（CSS 选择器）· scroll targets for role clicks（UI 结构配置，非文案） */
const ROLE_TARGETS = ['.section-spacing', '#timeline', '.stats-grid'] as const

/** 三项 role 文本 · three role texts */
const roleItems = computed(() => {
  const prefix = currentData.value.rolesPrefix || ''
  const rolesConf = currentData.value.roles
  return [
    `${prefix}${rolesConf.declaration}`,
    `${prefix}${stats.value.totalConcerts}   （${rolesConf.concertsLabel}）`,
    `${prefix}${stats.value.totalCities}   （${rolesConf.citiesLabel}）`
  ]
})

function handleRoleClick(index: number): void {
  const targetSelector = ROLE_TARGETS[index] ?? '#timeline'
  const target = document.querySelector(targetSelector) as HTMLElement | null
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="hero-section">
    <div class="profile-wrapper">
      <div class="orbit-container">
        <div class="avatar-section">
          <div class="avatar-container">
            <img src="/img/logo.jpg" alt="layicr" class="avatar-image" decoding="async" onerror="this.src='/img/logo.jpg'">
            <div class="status-dot"></div>
          </div>
          <div class="avatar-border"></div>
        </div>
      </div>

      <div class="profile-card">
        <div class="profile-label" id="profile-label">{{ currentData.profileLabel }}</div>
        <h1 class="profile-name">layicr</h1>

        <div class="profile-subtitle" id="profile-subtitle">{{ currentData.profileSubtitle }}</div>
        <ul class="roles-list" id="roles-list">
          <li
            v-for="(role, index) in roleItems"
            :key="index"
            class="role-item"
            :data-role-index="index"
            @click="handleRoleClick(index)"
          >{{ role }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
