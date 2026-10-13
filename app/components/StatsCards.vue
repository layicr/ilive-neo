<script setup lang="ts">
/**
 * 统计卡片 · Stats cards
 * @description 三张卡片从 0 计数到真实值（useCountUp 自带 SSR 透传与定时器生命周期，须原地保留这 3 次调用）；
 *              点击分别打开城市 / 票根弹窗（共享态，直接调用）。
 */
import { useCountUp } from '~/composables/useCountUp'
import { useData } from '~/composables/useData'
import { useNavigation } from '~/composables/useNavigation'
import { useTicketModal } from '~/composables/useTicketModal'
import { useAppI18n } from '~/composables/useI18n'

const { stats } = useData()
const { openCityModal } = useNavigation()
const { openTicketModal } = useTicketModal()
const { currentData } = useAppI18n()

const STAT_COUNTUP_DURATION = 5000
const STAT_COUNTUP_REPEAT = 120_000
const citiesCount = useCountUp(() => stats.value.totalCities, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
const artistsCount = useCountUp(() => stats.value.totalArtists, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
const concertsCount = useCountUp(() => stats.value.totalConcerts, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
</script>

<template>
  <section class="social-stats" id="influencer">
    <div class="stats-grid">
      <div class="stat-card cities" id="city-card" @click="openCityModal">
        <div class="stat-number" id="total-cities">{{ citiesCount }}</div>
        <div class="stat-label" id="cities-label">{{ currentData.citiesLabel }}</div>
      </div>
      <div class="stat-card artists">
        <div class="stat-number" id="total-artists">{{ artistsCount }}</div>
        <div class="stat-label" id="artists-label">{{ currentData.artistsLabel }}</div>
      </div>
      <div class="stat-card total" @click="openTicketModal">
        <div class="stat-number" id="total-concerts">{{ concertsCount }}</div>
        <div class="stat-label" id="total-label">{{ currentData.concertsLabel }}</div>
      </div>
    </div>
  </section>
</template>
