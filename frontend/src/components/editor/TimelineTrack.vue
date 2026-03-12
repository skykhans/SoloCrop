<script setup lang="ts">
import { computed } from 'vue'
import TimelineItemBlock from './TimelineItem.vue'
import type { TimelineItem, TimelineTrack } from '../../types/editor'

const props = defineProps<{
  track: TimelineTrack
  items: TimelineItem[]
  pxPerSecond: number
  selectedItemId: string | null
  durationMs: number
}>()

const emit = defineEmits<{
  select: [itemId: string]
  move: [itemId: string, startMs: number]
  trim: [itemId: string, edge: 'start' | 'end', ms: number]
  create: [trackId: string, startMs: number]
}>()

const totalWidth = computed(() => Math.max(800, (props.durationMs / 1000 + 5) * props.pxPerSecond))

function handleCanvasDoubleClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLDivElement | null
  if (!target) {
    return
  }
  const rect = target.getBoundingClientRect()
  const offsetX = Math.max(0, event.clientX - rect.left)
  const startMs = Math.floor((offsetX / props.pxPerSecond) * 1000)
  emit('create', props.track.id, startMs)
}
</script>

<template>
  <div class="timeline-track-row">
    <div class="timeline-track-name">{{ track.name }}</div>
    <div class="timeline-track-canvas" :style="{ width: `${totalWidth}px` }" @dblclick="handleCanvasDoubleClick">
      <TimelineItemBlock
        v-for="item in items"
        :key="item.id"
        :item="item"
        :px-per-second="pxPerSecond"
        :selected="item.id === selectedItemId"
        @select="(itemId) => emit('select', itemId)"
        @move="(itemId, startMs) => emit('move', itemId, startMs)"
        @trim="(itemId, edge, ms) => emit('trim', itemId, edge, ms)"
      />
    </div>
  </div>
</template>
