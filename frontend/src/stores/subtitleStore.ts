import { defineStore } from 'pinia'
import { transcribeLocal } from '../features/subtitle/asrService'
import type { SubtitleSegment, SubtitleSettings } from '../types/editor'

export const useSubtitleStore = defineStore('subtitle', {
  state: () => ({
    segments: [] as SubtitleSegment[],
    settings: {
      model: 'tiny',
      language: 'zh'
    } as SubtitleSettings,
    running: false,
    progress: 0
  }),
  actions: {
    setSettings(value: Partial<SubtitleSettings>) {
      this.settings = {
        ...this.settings,
        ...value
      }
    },

    loadFromSegments(value: SubtitleSegment[]) {
      this.segments = Array.isArray(value) ? value.slice().sort((a, b) => a.startMs - b.startMs) : []
    },

    addSegment(startMs = 0, endMs = 2000, text = '新字幕') {
      const safeStart = Math.max(0, Math.floor(startMs))
      const safeEnd = Math.max(safeStart + 100, Math.floor(endMs))
      this.segments = this.segments
        .concat({
          id: crypto.randomUUID(),
          startMs: safeStart,
          endMs: safeEnd,
          text,
          confidence: 1,
          enabled: true
        })
        .sort((a, b) => a.startMs - b.startMs)
    },

    duplicateSegment(id: string) {
      const item = this.segments.find((segment) => segment.id === id)
      if (!item) {
        return
      }
      const duration = Math.max(100, item.endMs - item.startMs)
      this.addSegment(item.endMs, item.endMs + duration, item.text)
    },

    removeSegment(id: string) {
      this.segments = this.segments.filter((segment) => segment.id !== id)
    },

    async runAutoSubtitle(file: File) {
      this.running = true
      this.progress = 0
      try {
        this.segments = await transcribeLocal(file, this.settings, (value) => {
          this.progress = value
        })
      } finally {
        this.running = false
      }
    },

    updateSegmentText(id: string, text: string) {
      const item = this.segments.find((segment) => segment.id === id)
      if (!item) {
        return
      }
      item.text = text
    },

    updateSegmentRange(id: string, startMs: number, endMs: number) {
      const item = this.segments.find((segment) => segment.id === id)
      if (!item) {
        return
      }
      item.startMs = Math.max(0, Math.floor(startMs))
      item.endMs = Math.max(item.startMs + 100, Math.floor(endMs))
    },

    setSegmentEnabled(id: string, enabled: boolean) {
      const item = this.segments.find((segment) => segment.id === id)
      if (!item) {
        return
      }
      item.enabled = enabled
    },

    offsetAll(deltaMs: number) {
      this.segments = this.segments.map((segment) => ({
        ...segment,
        startMs: Math.max(0, segment.startMs + deltaMs),
        endMs: Math.max(100, segment.endMs + deltaMs)
      }))
    }
  }
})
