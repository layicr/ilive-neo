<script setup lang="ts">
/**
 * 应用根组件 · App root component
 * @description 仅渲染页面与全局 Toast；元信息统一在 nuxt.config head 中配置
 *              Renders the page and the global error toast; head/meta is configured in nuxt.config
 */
import { useAppError } from '~/composables/useAppError'

const { toastMessage } = useAppError()
</script>

<template>
  <div>
    <NuxtPage />
    <Transition name="toast">
      <div v-if="toastMessage" class="error-toast" role="alert">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style>
/* 全局错误提示 Toast · Global error toast */
.error-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: #f44336;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
