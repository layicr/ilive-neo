<script setup lang="ts">
/** 许愿墙 · Wish wall */
import { useData } from '~/composables/useData'
import { useAppI18n } from '~/composables/useI18n'

const { localizedWishes } = useData()
const { currentData } = useAppI18n()
</script>

<template>
  <section class="wish-section" id="wishSection">
    <div class="wish-header">
      <h2 class="wish-title" id="wishTitle">{{ currentData.wishWall.title }}</h2>
      <div class="wish-count" id="wishCount">{{ currentData.wishWall.countPrefix }}<span>{{ localizedWishes.length }}</span>{{ currentData.wishWall.countSuffix }}</div>
    </div>
    <div v-if="localizedWishes.length === 0" class="wish-grid" id="wishGrid">
      <div class="wish-empty">{{ currentData.wishWall.emptyMessage }}</div>
    </div>
    <div v-else class="wish-grid" id="wishGrid">
      <div v-for="(wish, index) in localizedWishes" :key="wish.id" class="wish-card" :data-index="index" :data-wish-id="wish.id">
        <div class="wish-card-content">{{ wish.content }}</div>
        <div class="wish-card-footer">
          <div class="wish-card-likes" :class="{ liked: wish.liked }">
            <span>{{ wish.liked ? '❤️' : '🤍' }}</span>
            <span>{{ wish.likes || 0 }}</span>
          </div>
          <div class="wish-card-footer-spacer"></div>
        </div>
      </div>
    </div>
  </section>
</template>
