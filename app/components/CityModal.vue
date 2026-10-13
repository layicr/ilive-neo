<script setup lang="ts">
/** 城市列表模态 · City modal（打开态/数据/文案均为共享 composable，无需 props 透传） */
import { useNavigation } from '~/composables/useNavigation'
import { useData } from '~/composables/useData'
import { useAppI18n } from '~/composables/useI18n'

const { cityModalOpen, closeCityModal } = useNavigation()
const { localizedCities, counts } = useData()
const { currentData } = useAppI18n()
</script>

<template>
  <div class="city-modal" id="cityModal" :class="{ active: cityModalOpen }">
    <div class="city-modal-content">
      <div class="city-modal-header">
        <button class="city-modal-close" id="closeCityModal" @click="closeCityModal">&times;</button>
        <h2 class="city-modal-title" id="city-modal-title">{{ currentData.modalTitle }}</h2>
      </div>
      <div class="city-list" id="cityList">
        <div v-for="city in localizedCities" :key="city.id" class="city-item" :data-city-id="city.id">
          <span v-if="city.icon" class="city-icon">{{ city.icon }}</span>
          <span class="city-name">{{ city.name }}</span>
          <span class="city-concerts">{{ currentData.cityList.concertsPrefix }}{{ counts[city.id] ?? 0 }}{{ currentData.cityList.concertsSuffix }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 城市弹窗关闭按钮 · city modal close button */
#closeCityModal {
  position: absolute;
  top: 8px;
  right: 12px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  padding: 4px 8px;
  transition: opacity 0.2s, transform 0.15s;
}
#closeCityModal:hover {
  opacity: 0.7;
  transform: scale(1.1);
}
</style>
