<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineItem } from '../../types/editor'

const props = defineProps<{
  item: TimelineItem
  pxPerSecond: number
  selected: boolean
}>()

const emit = defineEmits<{
  select: [itemId: string]
  move: [itemId: string, startMs: number]
  trim: [itemId: string, edge: 'start' | 'end', ms: number]
}>()

const left = computed(() => (props.item.startMs / 1000) * props.pxPerSecond)
const width = computed(() => Math.max(24, ((props.item.endMs - props.item.startMs) / 1000) * props.pxPerSecond))

function startDrag(event: PointerEvent) {
  const startX = event.clientX
  const initial = props.item.startMs
  const onMove = (e: PointerEvent) => {
    const deltaMs = ((e.clientX - startX) / props.pxPerSecond) * 1000
    emit('move', props.item.id, Math.floor(initial + deltaMs))
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function startTrim(event: PointerEvent, edge: 'start' | 'end') {
  event.stopPropagation()
  const startX = event.clientX
  const initial = edge === 'start' ? props.item.startMs : props.item.endMs
  const onMove = (e: PointerEvent) => {
    const deltaMs = ((e.clientX - startX) / props.pxPerSecond) * 1000
    emit('trim', props.item.id, edge, Math.floor(initial + deltaMs))
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div
    class="timeline-item"
    :class="{ selected }"
    :style="{ left: `${left}px`, width: `${width}px`, backgroundColor: item.color || '#7fa8ff' }"
    @pointerdown="startDrag"
    @click.stop="emit('select', item.id)"
  >
    <span class="timeline-item-label">{{ item.label }}</span>
    <span class="timeline-item-handle start" @pointerdown="(event) => startTrim(event, 'start')" />
    <span class="timeline-item-handle end" @pointerdown="(event) => startTrim(event, 'end')" />
  </div>
</template>
