<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  durationMs: number
  pxPerSecond: number
  playheadMs: number
}>()

const totalWidth = computed(() => Math.max(800, (props.durationMs / 1000 + 5) * props.pxPerSecond))
const tickSeconds = computed(() => {
  const total = Math.ceil(props.durationMs / 1000) + 5
  return Array.from({ length: total + 1 }, (_, i) => i)
})
const playheadLeft = computed(() => (props.playheadMs / 1000) * props.pxPerSecond)

function format(second: number): string {
  const m = Math.floor(second / 60)
  const s = second % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="timeline-ruler" :style="{ width: `${totalWidth}px` }">
    <div
      v-for="second in tickSeconds"
      :key="second"
      class="timeline-tick"
      :style="{ left: `${second * pxPerSecond}px` }"
    >
      <span>{{ format(second) }}</span>
    </div>
    <div class="timeline-playhead-line" :style="{ left: `${playheadLeft}px` }" />
  </div>
</template>
