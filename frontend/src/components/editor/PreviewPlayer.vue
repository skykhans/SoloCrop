<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MediaAsset } from '../../types/media'
import type { TimelineItem } from '../../types/editor'
import { normalizeStickerStyle } from '../../features/editor/stickerLibrary'

const props = defineProps<{
  mediaItems: TimelineItem[]
  stickerItems: TimelineItem[]
  mediaAssets: MediaAsset[]
  playheadMs: number
  playing: boolean
}>()

const emit = defineEmits<{
  timeupdate: [ms: number]
  playingchange: [playing: boolean]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const currentMedia = computed(() => {
  const active = props.mediaItems.find((item) => props.playheadMs >= item.startMs && props.playheadMs < item.endMs)
  if (!active?.mediaId) {
    return null
  }
  const media = props.mediaAssets.find((entry) => entry.id === active.mediaId)
  return media ? { item: active, media } : null
})

const videoFilterStyle = computed(() => {
  const adjust = currentMedia.value?.item.visualAdjust
  const brightness = adjust?.brightness ?? 0
  const contrast = adjust?.contrast ?? 1
  const saturation = adjust?.saturation ?? 1
  return {
    filter: `brightness(${1 + brightness}) contrast(${contrast}) saturate(${saturation})`
  }
})

const activeStickers = computed(() =>
  props.stickerItems
    .filter((item) => props.playheadMs >= item.startMs && props.playheadMs < item.endMs)
    .map((item) => {
      const adjust = item.stickerAdjust ?? { xPct: 0.5, yPct: 0.2, scale: 1, opacity: 1 }
      const style = normalizeStickerStyle(item.stickerStyle)
      return {
        id: item.id,
        text: item.text || item.label || 'STICKER',
        xPct: adjust.xPct,
        yPct: adjust.yPct,
        scale: adjust.scale,
        opacity: adjust.opacity,
        variant: style.variant,
        bgColor: style.bgColor,
        textColor: style.textColor,
        borderColor: style.borderColor
      }
    })
)

watch(
  currentMedia,
  (value) => {
    const video = videoRef.value
    if (!video || !value) {
      return
    }
    video.src = URL.createObjectURL(value.media.file)
    video.currentTime = value.item.sourceInMs / 1000
  },
  { immediate: true }
)

watch(
  () => props.playing,
  async (playing) => {
    const video = videoRef.value
    if (!video) {
      return
    }
    if (playing) {
      try {
        await video.play()
      } catch {
        emit('playingchange', false)
      }
      return
    }
    video.pause()
  }
)

watch(
  () => props.playheadMs,
  (ms) => {
    const active = currentMedia.value
    const video = videoRef.value
    if (!active || !video) {
      return
    }
    const target = (active.item.sourceInMs + (ms - active.item.startMs)) / 1000
    if (Math.abs(video.currentTime - target) > 0.12) {
      video.currentTime = target
    }
  }
)

function onTimeUpdate() {
  const active = currentMedia.value
  const video = videoRef.value
  if (!active || !video) {
    return
  }
  const globalMs = active.item.startMs + Math.floor((video.currentTime * 1000) - active.item.sourceInMs)
  emit('timeupdate', Math.max(active.item.startMs, globalMs))
}
</script>

<template>
  <div class="preview-player">
    <div class="preview-stage">
      <video
        ref="videoRef"
        controls
        :style="videoFilterStyle"
        @timeupdate="onTimeUpdate"
        @pause="emit('playingchange', false)"
      />
      <div class="preview-overlay">
        <div
          v-for="sticker in activeStickers"
          :key="sticker.id"
          class="preview-sticker"
          :data-variant="sticker.variant"
          :style="{
            left: `${sticker.xPct * 100}%`,
            top: `${sticker.yPct * 100}%`,
            transform: `translate(-50%, -50%) scale(${sticker.scale})`,
            opacity: sticker.opacity,
            color: sticker.textColor,
            '--sticker-bg': sticker.bgColor,
            '--sticker-border': sticker.borderColor
          }"
        >
          {{ sticker.text }}
        </div>
      </div>
    </div>
    <p class="preview-hint">预览基于时间轴播放头联动，首版为单路预览。</p>
  </div>
</template>
