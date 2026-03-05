import { defineStore } from 'pinia'
import { db } from '../db/indexedDb'
import type { MediaAsset } from '../types/media'
import type { EditorProjectDraft, ExportBitratePreset, ExportMode, ExportPreset, TimelineClip } from '../types/editor'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    projectId: 'default',
    clips: [] as TimelineClip[],
    selectedClipId: null as string | null,
    playheadSec: 0,
    exportPreset: 'source' as ExportPreset,
    exportMode: 'final' as ExportMode,
    exportBitrate: 'auto' as ExportBitratePreset,
    loading: false,
    saving: false
  }),
  getters: {
    selectedClip(state): TimelineClip | null {
      return state.clips.find((item) => item.id === state.selectedClipId) ?? null
    },
    totalDuration(state): number {
      return state.clips.reduce((sum, clip) => sum + (clip.endSec - clip.startSec), 0)
    }
  },
  actions: {
    async init(projectId: string) {
      this.loading = true
      this.projectId = projectId
      this.clips = []
      this.selectedClipId = null
      this.playheadSec = 0
      this.exportPreset = 'source'
      this.exportMode = 'final'
      this.exportBitrate = 'auto'

      const draft = await db.projectDrafts.get(projectId)
      if (draft) {
        const parsed = safeParse(draft.content)
        if (parsed) {
          this.applyDraft(parsed)
        }
      }

      this.loading = false
    },

    addClipFromMedia(media: MediaAsset) {
      const clip: TimelineClip = {
        id: crypto.randomUUID(),
        mediaId: media.id,
        mediaName: media.name,
        startSec: 0,
        endSec: Number(media.durationSeconds.toFixed(3)),
        volume: 1,
        speed: 1,
        position: this.clips.length
      }

      this.clips.push(clip)
      this.selectedClipId = clip.id
      this.reindex()
    },

    removeSelectedClip() {
      if (!this.selectedClipId) {
        return
      }
      this.clips = this.clips.filter((item) => item.id !== this.selectedClipId)
      this.selectedClipId = this.clips[0]?.id ?? null
      this.reindex()
    },

    selectClip(clipId: string) {
      this.selectedClipId = clipId
    },

    splitSelectedClip() {
      const clip = this.selectedClip
      if (!clip) {
        throw new Error('请先选择片段')
      }

      const splitSec = this.playheadSec
      if (splitSec <= clip.startSec || splitSec >= clip.endSec) {
        throw new Error('分割点必须在片段范围内')
      }

      const rightClip: TimelineClip = {
        ...clip,
        id: crypto.randomUUID(),
        startSec: Number(splitSec.toFixed(3)),
        position: clip.position + 1
      }

      clip.endSec = Number(splitSec.toFixed(3))
      this.clips.splice(clip.position + 1, 0, rightClip)
      this.reindex()
      this.selectedClipId = rightClip.id
    },

    moveSelected(direction: 'up' | 'down') {
      const clip = this.selectedClip
      if (!clip) {
        return
      }

      const index = clip.position
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= this.clips.length) {
        return
      }

      const temp = this.clips[index]
      this.clips[index] = this.clips[target]
      this.clips[target] = temp
      this.reindex()
    },

    setSelectedVolume(value: number) {
      const clip = this.selectedClip
      if (!clip) {
        return
      }
      clip.volume = Number(value.toFixed(2))
    },

    setSelectedSpeed(value: number) {
      const clip = this.selectedClip
      if (!clip) {
        return
      }
      clip.speed = Number(value.toFixed(2))
    },

    setSelectedRange(startSec: number, endSec: number) {
      const clip = this.selectedClip
      if (!clip) {
        throw new Error('请先选择片段')
      }

      const safeStart = Number(startSec.toFixed(3))
      const safeEnd = Number(endSec.toFixed(3))
      if (safeStart < 0 || safeEnd <= safeStart) {
        throw new Error('裁剪区间无效')
      }

      clip.startSec = safeStart
      clip.endSec = safeEnd
    },

    setPlayhead(value: number) {
      this.playheadSec = Number(Math.max(0, value).toFixed(3))
    },

    setExportPreset(value: ExportPreset) {
      this.exportPreset = value
    },

    setExportMode(value: ExportMode) {
      this.exportMode = value
    },

    setExportBitrate(value: ExportBitratePreset) {
      this.exportBitrate = value
    },

    async saveDraft() {
      this.saving = true
      const payload: EditorProjectDraft = {
        projectId: this.projectId,
        clips: this.clips,
        playheadSec: this.playheadSec,
        selectedClipId: this.selectedClipId,
        exportPreset: this.exportPreset,
        exportMode: this.exportMode,
        exportBitrate: this.exportBitrate
      }

      await db.projectDrafts.put({
        id: this.projectId,
        name: `project-${this.projectId}`,
        content: JSON.stringify(payload),
        updatedAt: new Date().toISOString()
      })
      this.saving = false
    },

    applyDraft(draft: EditorProjectDraft) {
      this.clips = Array.isArray(draft.clips) ? draft.clips : []
      this.playheadSec = Number(draft.playheadSec ?? 0)
      this.selectedClipId = draft.selectedClipId ?? this.clips[0]?.id ?? null
      this.exportPreset = draft.exportPreset === 'p720' || draft.exportPreset === 'p1080' ? draft.exportPreset : 'source'
      this.exportMode = draft.exportMode === 'merged' || draft.exportMode === 'pieces' ? draft.exportMode : 'final'
      this.exportBitrate = isValidBitrate(draft.exportBitrate) ? draft.exportBitrate : 'auto'
      this.reindex()
    },

    reindex() {
      this.clips.forEach((item, idx) => {
        item.position = idx
      })
    }
  }
})

function safeParse(value: string): EditorProjectDraft | null {
  try {
    return JSON.parse(value) as EditorProjectDraft
  } catch {
    return null
  }
}

function isValidBitrate(value: unknown): value is ExportBitratePreset {
  return value === 'auto' || value === '2000k' || value === '4000k' || value === '8000k'
}
