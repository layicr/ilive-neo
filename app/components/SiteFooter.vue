<script setup lang="ts">
/** 页脚 · Footer */
import { useFriendLink } from '~/composables/useFriendLink'
import { useAppI18n } from '~/composables/useI18n'

const { friendLinks } = useFriendLink()
const { currentData } = useAppI18n()
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand">
        <span class="footer-logo"></span>
        <span class="footer-divider"></span>
        <span class="footer-tagline" id="footer-text">{{ currentData.footerText }}</span>
      </div>
      <div class="footer-social">
        <a
          v-for="link in friendLinks"
          :key="link.href"
          class="social-link"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.title"
        >
          <i :class="link.icon" aria-hidden="true"></i>
        </a>
      </div>
      <div class="footer-bottom">
        <span> ©<span id="site-name">{{ currentData.siteName }}</span></span>
        <span class="footer-separator"></span>
        <span></span>
      </div>
    </div>
  </footer>
</template>
