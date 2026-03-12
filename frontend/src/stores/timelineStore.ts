import { defineStore } from 'pinia'
import { db } from '../db/indexedDb'
import { createDefaultStickerStyle, normalizeStickerStyle } from '../features/editor/stickerLibrary'
import type { MediaAsset } from '../types/media'
import type {
  EditorProjectDraft,
  PlayheadState,
  SelectionRange,
  SnapLine,
  SubtitleSegment,
  SubtitleSettings,
  TemplatePreset,
  TimelineClip,
  TimelineItem,
  TimelineProject,
  TimelineTrack
} from '../types/editor'

const VIDEO_TRACK_ID = 'video-main'
const AUDIO_TRACK_ID = 'audio-main'
const SUBTITLE_TRACK_ID = 'subtitle-main'
const STICKER_TRACK_ID = 'sticker-main'
const SNAP_TOLERANCE_MS = 80
const HISTORY_LIMIT = 50

export const useTimelineStore = defineStore('timeline', {
  state: () => ({
    projectId: 'default',
    timeline: createDefaultTimeline() as TimelineProject,
    selectedItemId: null as string | null,
    playhead: { currentMs: 0, playing: false } as PlayheadState,
    zoom: 1,
    selection: null as SelectionRange | null,
    undoStack: [] as TimelineProject[],
    redoStack: [] as TimelineProject[],
    subtitleSegmentsSnapshot: [] as SubtitleSegment[],
    loading: false,
    saving: false
  }),
  getters: {
    tracks(state): TimelineTrack[] {
      return state.timeline.tracks
    },
    items(state): TimelineItem[] {
      return state.timeline.items
    },
    selectedItem(state): TimelineItem | null {
      return state.timeline.items.find((item) => item.id === state.selectedItemId) ?? null
    },
    selectedVideoItem(state): TimelineItem | null {
      const selected = state.timeline.items.find((item) => item.id === state.selectedItemId)
      if (!selected) {
        return null
      }
      return getTrackType(state.timeline, selected.trackId) === 'video' ? selected : null
    },
    videoItems(state): TimelineItem[] {
      return state.timeline.items.filter((item) => getTrackType(state.timeline, item.trackId) === 'video').sort(sortByStart)
    },
    audioItems(state): TimelineItem[] {
      return state.timeline.items.filter((item) => getTrackType(state.timeline, item.trackId) === 'audio').sort(sortByStart)
    },
    subtitleItems(state): TimelineItem[] {
      return state.timeline.items.filter((item) => getTrackType(state.timeline, item.trackId) === 'subtitle').sort(sortByStart)
    },
    stickerItems(state): TimelineItem[] {
      return state.timeline.items.filter((item) => getTrackType(state.timeline, item.trackId) === 'sticker').sort(sortByStart)
    },
    selectedStickerItem(state): TimelineItem | null {
      const selected = state.timeline.items.find((item) => item.id === state.selectedItemId)
      if (!selected) {
        return null
      }
      return getTrackType(state.timeline, selected.trackId) === 'sticker' ? selected : null
    }
  },
  actions: {
    async init(projectId: string) {
      this.loading = true
      this.projectId = projectId
      this.timeline = createDefaultTimeline()
      this.selectedItemId = null
      this.playhead = { currentMs: 0, playing: false }
      this.zoom = 1
      this.selection = null
      this.undoStack = []
      this.redoStack = []
      this.subtitleSegmentsSnapshot = []

      const draft = await db.projectDrafts.get(projectId)
      if (draft) {
        const parsed = safeParse(draft.content)
        if (parsed) {
          this.applyDraft(parsed)
        }
      }
      this.loading = false
    },

    applyDraft(draft: EditorProjectDraft) {
      if (draft.timeline) {
        this.timeline = normalizeTimeline(draft.timeline)
      } else {
        this.timeline = migrateLegacyClipsToTimeline(Array.isArray(draft.clips) ? draft.clips : [])
      }
      this.playhead.currentMs = Math.max(0, Math.floor((draft.playheadSec ?? 0) * 1000))
      this.selectedItemId = draft.selectedClipId ?? this.timeline.items[0]?.id ?? null
      this.subtitleSegmentsSnapshot = Array.isArray(draft.subtitleSegments)
        ? draft.subtitleSegments.slice().sort((a, b) => a.startMs - b.startMs)
        : []
      this.recalculateDuration()
      this.undoStack = []
      this.redoStack = []
    },

    async saveDraft(extra?: {
      exportPreset?: EditorProjectDraft['exportPreset']
      exportMode?: EditorProjectDraft['exportMode']
      exportBitrate?: EditorProjectDraft['exportBitrate']
      subtitleSegments?: SubtitleSegment[]
      subtitleSettings?: SubtitleSettings
    }) {
      this.saving = true
      this.recalculateDuration()
      const legacyClips = this.toLegacyClips()
      this.subtitleSegmentsSnapshot = Array.isArray(extra?.subtitleSegments)
        ? extra.subtitleSegments.slice().sort((a, b) => a.startMs - b.startMs)
        : this.subtitleSegmentsSnapshot
      const payload: EditorProjectDraft = {
        projectId: this.projectId,
        clips: legacyClips,
        playheadSec: Number((this.playhead.currentMs / 1000).toFixed(3)),
        selectedClipId: this.selectedItemId,
        exportPreset: extra?.exportPreset ?? 'source',
        exportMode: extra?.exportMode ?? 'final',
        exportBitrate: extra?.exportBitrate ?? 'auto',
        timeline: this.timeline,
        subtitleSegments: this.subtitleSegmentsSnapshot,
        subtitleSettings: extra?.subtitleSettings ?? { model: 'tiny', language: 'zh' }
      }

      await db.projectDrafts.put({
        id: this.projectId,
        name: `project-${this.projectId}`,
        content: JSON.stringify(payload),
        updatedAt: new Date().toISOString()
      })
      this.saving = false
    },

    addMedia(media: MediaAsset) {
      this.pushHistory()
      const durationMs = Math.floor(media.durationSeconds * 1000)
      const startMs = this.timeline.durationMs
      const endMs = startMs + durationMs

      const videoItem: TimelineItem = {
        id: crypto.randomUUID(),
        trackId: VIDEO_TRACK_ID,
        mediaId: media.id,
        label: media.name,
        startMs,
        endMs,
        sourceInMs: 0,
        sourceOutMs: durationMs,
        speed: 1,
        gain: 1,
        visualAdjust: createDefaultVisualAdjust(),
        transition: createDefaultTransitionAdjust(),
        color: '#6a9cff'
      }
      const audioItem: TimelineItem = {
        ...videoItem,
        id: crypto.randomUUID(),
        trackId: AUDIO_TRACK_ID,
        color: '#5bc58c'
      }

      this.timeline.items.push(videoItem, audioItem)
      this.selectedItemId = videoItem.id
      this.recalculateDuration()
      this.redoStack = []
    },

    updateSelectedVideoAdjust(partial: Partial<TimelineItem['visualAdjust']>) {
      const selected = this.selectedVideoItem
      if (!selected) {
        throw new Error('Please select a video clip first')
      }
      this.pushHistory()
      selected.visualAdjust = {
        ...createDefaultVisualAdjust(),
        ...(selected.visualAdjust ?? {}),
        ...partial
      }
      this.redoStack = []
    },

    updateSelectedVideoTransition(partial: Partial<TimelineItem['transition']>) {
      const selected = this.selectedVideoItem
      if (!selected) {
        throw new Error('Please select a video clip first')
      }
      this.pushHistory()
      const next = {
        ...createDefaultTransitionAdjust(),
        ...(selected.transition ?? {}),
        ...partial
      }
      selected.transition = {
        fadeInMs: Math.max(0, Math.floor(next.fadeInMs)),
        fadeOutMs: Math.max(0, Math.floor(next.fadeOutMs))
      }
      this.redoStack = []
    },

    resetSelectedVideoEffects() {
      const selected = this.selectedVideoItem
      if (!selected) {
        throw new Error('Please select a video clip first')
      }
      this.pushHistory()
      selected.visualAdjust = createDefaultVisualAdjust()
      selected.transition = createDefaultTransitionAdjust()
      this.redoStack = []
    },

    addSubtitle(startMs: number, endMs: number, text: string) {
      this.pushHistory()
      this.timeline.items.push({
        id: crypto.randomUUID(),
        trackId: SUBTITLE_TRACK_ID,
        label: text || '字幕',
        text,
        startMs,
        endMs,
        sourceInMs: 0,
        sourceOutMs: Math.max(1, endMs - startMs),
        color: '#f6b24f'
      })
      this.recalculateDuration()
      this.redoStack = []
    },

    addSticker(text: string, startMs?: number, durationMs = 2000, stickerStyle?: Partial<TimelineItem['stickerStyle']>) {
      this.pushHistory()
      const safeText = (text || 'STICKER').trim().slice(0, 24) || 'STICKER'
      const start = Math.max(0, Math.floor(startMs ?? this.playhead.currentMs))
      const end = start + Math.max(300, Math.floor(durationMs))
      const item: TimelineItem = {
        id: crypto.randomUUID(),
        trackId: STICKER_TRACK_ID,
        label: safeText,
        text: safeText,
        startMs: start,
        endMs: end,
        sourceInMs: 0,
        sourceOutMs: end - start,
        stickerAdjust: createDefaultStickerAdjust(),
        stickerStyle: normalizeStickerStyle(stickerStyle),
        color: '#b682ff'
      }
      const duration = item.endMs - item.startMs
      const overlapFixed = this.resolveTrackOverlap(item, item.startMs, duration)
      item.startMs = overlapFixed
      item.endMs = overlapFixed + duration
      this.timeline.items.push(item)
      this.selectedItemId = item.id
      this.recalculateDuration()
      this.redoStack = []
    },

    applyTemplatePreset(template: TemplatePreset) {
      const videos = this.videoItems
      if (!videos.length) {
        throw new Error('请先添加视频到时间轴')
      }

      const baseStartMs = videos[0].startMs
      const baseEndMs = videos[videos.length - 1].endMs
      this.pushHistory()

      for (const item of videos) {
        item.visualAdjust = {
          ...createDefaultVisualAdjust(),
          ...(item.visualAdjust ?? {}),
          ...(template.visualAdjust ?? {})
        }
        item.transition = {
          ...createDefaultTransitionAdjust(),
          ...(item.transition ?? {}),
          ...(template.transition ?? {})
        }
      }

      for (const sticker of template.stickers ?? []) {
        const durationMs = Math.max(300, Math.floor(sticker.durationMs))
        const preferredStart = baseStartMs + Math.max(0, Math.floor(sticker.startOffsetMs))
        const boundedStart = clamp(preferredStart, baseStartMs, Math.max(baseStartMs, baseEndMs - durationMs))
        const item: TimelineItem = {
          id: crypto.randomUUID(),
          trackId: STICKER_TRACK_ID,
          label: (sticker.text || 'STICKER').trim().slice(0, 24) || 'STICKER',
          text: (sticker.text || 'STICKER').trim().slice(0, 24) || 'STICKER',
          startMs: boundedStart,
          endMs: boundedStart + durationMs,
          sourceInMs: 0,
          sourceOutMs: durationMs,
          stickerAdjust: {
            ...createDefaultStickerAdjust(),
            ...(sticker.adjust ?? {})
          },
          stickerStyle: normalizeStickerStyle(sticker.style),
          color: '#b682ff'
        }
        const safeStart = this.resolveTrackOverlap(item, item.startMs, durationMs)
        item.startMs = safeStart
        item.endMs = safeStart + durationMs
        this.timeline.items.push(item)
      }

      for (const subtitle of template.subtitles ?? []) {
        const durationMs = Math.max(300, Math.floor(subtitle.durationMs))
        const startMs = baseStartMs + Math.max(0, Math.floor(subtitle.startOffsetMs))
        this.timeline.items.push({
          id: crypto.randomUUID(),
          trackId: SUBTITLE_TRACK_ID,
          label: subtitle.text || '字幕',
          text: subtitle.text || '字幕',
          startMs,
          endMs: startMs + durationMs,
          sourceInMs: 0,
          sourceOutMs: durationMs,
          color: '#f6b24f'
        })
      }

      this.selectedItemId = videos[0].id
      this.recalculateDuration()
      this.redoStack = []
    },

    captureTemplatePreset(name: string, description?: string): TemplatePreset {
      const videos = this.videoItems
      if (!videos.length) {
        throw new Error('Please add a video clip first')
      }

      const baseStartMs = videos[0].startMs
      const primaryVideo = this.selectedVideoItem ?? videos[0]
      const safeName = (name || '').trim().slice(0, 24)
      if (!safeName) {
        throw new Error('Please enter a template name')
      }

      return {
        id: `custom-${crypto.randomUUID()}`,
        name: safeName,
        description: (description || '').trim().slice(0, 80) || `Saved from current timeline with ${videos.length} video clip(s)`,
        source: 'custom',
        visualAdjust: normalizeVisualAdjust(primaryVideo.visualAdjust),
        transition: normalizeTransition(primaryVideo.transition),
        stickers: this.stickerItems.map((item) => ({
          text: item.text ?? item.label,
          startOffsetMs: Math.max(0, item.startMs - baseStartMs),
          durationMs: Math.max(300, item.endMs - item.startMs),
          adjust: { ...(item.stickerAdjust ?? createDefaultStickerAdjust()) },
          style: { ...(item.stickerStyle ?? createDefaultStickerStyle()) }
        })),
        subtitles: this.subtitleItems.map((item) => ({
          text: item.text ?? item.label,
          startOffsetMs: Math.max(0, item.startMs - baseStartMs),
          durationMs: Math.max(300, item.endMs - item.startMs)
        }))
      }
    },

    syncSubtitlesFromSegments(segments: SubtitleSegment[], recordHistory = true) {
      if (recordHistory) {
        this.pushHistory()
      }
      const subtitleItems = (Array.isArray(segments) ? segments : [])
        .slice()
        .sort((a, b) => a.startMs - b.startMs)
        .map<TimelineItem>((segment) => ({
          id: segment.id,
          trackId: SUBTITLE_TRACK_ID,
          label: segment.text || '字幕',
          text: segment.text || '字幕',
          startMs: Math.max(0, Math.floor(segment.startMs)),
          endMs: Math.max(Math.floor(segment.startMs) + 100, Math.floor(segment.endMs)),
          sourceInMs: 0,
          sourceOutMs: Math.max(100, Math.floor(segment.endMs) - Math.floor(segment.startMs)),
          color: segment.enabled ? '#f6b24f' : '#c8ced8'
        }))

      this.timeline.items = this.timeline.items
        .filter((item) => item.trackId !== SUBTITLE_TRACK_ID)
        .concat(subtitleItems)
      this.subtitleSegmentsSnapshot = (Array.isArray(segments) ? segments : [])
        .slice()
        .sort((a, b) => a.startMs - b.startMs)
      this.recalculateDuration()
      if (recordHistory) {
        this.redoStack = []
      }
    },

    toSubtitleSegments(): SubtitleSegment[] {
      return this.subtitleItems.map((item) => ({
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: item.text ?? item.label,
        confidence: 1,
        enabled: item.color !== '#c8ced8'
      }))
    },

    updateSelectedStickerText(text: string) {
      const selected = this.selectedStickerItem
      if (!selected) {
        throw new Error('请先选中贴纸片段')
      }
      this.pushHistory()
      const safeText = (text || '').trim().slice(0, 24)
      selected.text = safeText || 'STICKER'
      selected.label = selected.text
      this.redoStack = []
    },

    updateSelectedStickerAdjust(partial: Partial<TimelineItem['stickerAdjust']>) {
      const selected = this.selectedStickerItem
      if (!selected) {
        throw new Error('请先选中贴纸片段')
      }
      this.pushHistory()
      const next = {
        ...createDefaultStickerAdjust(),
        ...(selected.stickerAdjust ?? {}),
        ...partial
      }
      selected.stickerAdjust = {
        xPct: clamp(next.xPct, 0, 1),
        yPct: clamp(next.yPct, 0, 1),
        scale: clamp(next.scale, 0.5, 3),
        opacity: clamp(next.opacity, 0.1, 1)
      }
      this.redoStack = []
    },

    updateSelectedStickerStyle(partial: Partial<TimelineItem['stickerStyle']>) {
      const selected = this.selectedStickerItem
      if (!selected) {
        throw new Error('请先选中贴纸片段')
      }
      this.pushHistory()
      selected.stickerStyle = normalizeStickerStyle({
        ...(selected.stickerStyle ?? createDefaultStickerStyle()),
        ...(partial ?? {})
      })
      this.redoStack = []
    },

    applySelectedVideoFilterPreset(preset: Partial<TimelineItem['visualAdjust']>) {
      const selected = this.selectedVideoItem
      if (!selected) {
        throw new Error('Please select a video clip first')
      }
      this.pushHistory()
      selected.visualAdjust = {
        ...createDefaultVisualAdjust(),
        ...(selected.visualAdjust ?? {}),
        ...(preset ?? {})
      }
      this.redoStack = []
    },

    applyTransitionToAllVideos(transition: Partial<TimelineItem['transition']>) {
      const videos = this.videoItems
      if (!videos.length) {
        throw new Error('请先添加视频到时间轴')
      }
      this.pushHistory()
      for (const item of videos) {
        const next = {
          ...createDefaultTransitionAdjust(),
          ...(item.transition ?? {}),
          ...(transition ?? {})
        }
        item.transition = {
          fadeInMs: Math.max(0, Math.floor(next.fadeInMs)),
          fadeOutMs: Math.max(0, Math.floor(next.fadeOutMs))
        }
      }
      this.redoStack = []
    },

    updateSubtitleText(itemId: string, text: string) {
      const item = this.timeline.items.find((entry) => entry.id === itemId)
      if (!item || getTrackType(this.timeline, item.trackId) !== 'subtitle') {
        return
      }
      item.text = text
      item.label = text
    },

    selectItem(itemId: string | null) {
      this.selectedItemId = itemId
    },

    deleteSelected() {
      const selected = this.selectedItem
      if (!selected) {
        return
      }
      this.pushHistory()
      this.timeline.items = this.timeline.items.filter((item) => item.id !== selected.id)
      this.selectedItemId = this.timeline.items[0]?.id ?? null
      this.recalculateDuration()
      this.redoStack = []
    },

    splitSelectedAtPlayhead() {
      const selected = this.selectedItem
      if (!selected) {
        throw new Error('Please select a timeline item first')
      }
      const selectedType = getTrackType(this.timeline, selected.trackId)
      if (selectedType === 'subtitle' || selectedType === 'sticker') {
        throw new Error('当前片段类型暂不支持分割')
      }

      const splitAt = this.playhead.currentMs
      if (splitAt <= selected.startMs || splitAt >= selected.endMs) {
        throw new Error('Playhead must be inside the selected clip')
      }

      this.pushHistory()
      const leftDuration = splitAt - selected.startMs
      const rightDuration = selected.endMs - splitAt
      const right: TimelineItem = {
        ...selected,
        id: crypto.randomUUID(),
        startMs: splitAt,
        endMs: splitAt + rightDuration,
        sourceInMs: selected.sourceInMs + leftDuration,
        sourceOutMs: selected.sourceOutMs
      }
      selected.endMs = splitAt
      selected.sourceOutMs = selected.sourceInMs + leftDuration
      this.timeline.items.push(right)
      this.selectedItemId = right.id
      this.recalculateDuration()
      this.redoStack = []
    },

    moveItem(itemId: string, proposedStartMs: number) {
      const item = this.timeline.items.find((entry) => entry.id === itemId)
      if (!item) {
        return
      }

      this.pushHistory()
      const duration = item.endMs - item.startMs
      const snappedStart = this.applySnap(item, Math.max(0, proposedStartMs))
      const boundedStart = this.resolveTrackOverlap(item, snappedStart, duration)
      item.startMs = boundedStart
      item.endMs = boundedStart + duration
      this.recalculateDuration()
      this.redoStack = []
    },

    trimItem(itemId: string, edge: 'start' | 'end', targetMs: number) {
      const item = this.timeline.items.find((entry) => entry.id === itemId)
      if (!item) {
        return
      }

      this.pushHistory()
      if (edge === 'start') {
        const maxStart = item.endMs - 100
        const safe = Math.min(Math.max(0, targetMs), maxStart)
        const delta = safe - item.startMs
        item.startMs = safe
        if (getTrackType(this.timeline, item.trackId) !== 'sticker') {
          item.sourceInMs += delta
        }
      } else {
        const minEnd = item.startMs + 100
        const safe = Math.max(minEnd, targetMs)
        item.endMs = safe
        if (getTrackType(this.timeline, item.trackId) !== 'sticker') {
          item.sourceOutMs = item.sourceInMs + (item.endMs - item.startMs)
        }
      }

      const duration = item.endMs - item.startMs
      const overlapFixed = this.resolveTrackOverlap(item, item.startMs, duration)
      item.startMs = overlapFixed
      item.endMs = overlapFixed + duration
      this.recalculateDuration()
      this.redoStack = []
    },

    setPlayhead(ms: number) {
      this.playhead.currentMs = Math.max(0, Math.floor(ms))
    },

    setPlaying(playing: boolean) {
      this.playhead.playing = playing
    },

    setZoom(value: number) {
      this.zoom = Math.min(4, Math.max(0.4, Number(value.toFixed(2))))
    },

    undo() {
      if (!this.undoStack.length) {
        return
      }
      const previous = this.undoStack.pop()!
      this.redoStack.push(cloneTimeline(this.timeline))
      this.timeline = cloneTimeline(previous)
      this.recalculateDuration()
    },

    redo() {
      if (!this.redoStack.length) {
        return
      }
      const next = this.redoStack.pop()!
      this.undoStack.push(cloneTimeline(this.timeline))
      this.timeline = cloneTimeline(next)
      this.recalculateDuration()
    },

    toLegacyClips(): TimelineClip[] {
      const videos = this.videoItems
      return videos.map((item, index) => ({
        id: item.id,
        mediaId: item.mediaId ?? '',
        mediaName: item.label,
        startSec: Number((item.sourceInMs / 1000).toFixed(3)),
        endSec: Number((item.sourceOutMs / 1000).toFixed(3)),
        volume: Number((item.gain ?? 1).toFixed(2)),
        speed: Number((item.speed ?? 1).toFixed(2)),
        position: index,
        visualAdjust: normalizeVisualAdjust(item.visualAdjust),
        transition: normalizeTransition(item.transition)
      }))
    },

    pushHistory() {
      this.undoStack.push(cloneTimeline(this.timeline))
      if (this.undoStack.length > HISTORY_LIMIT) {
        this.undoStack.shift()
      }
    },

    applySnap(item: TimelineItem, proposedStartMs: number): number {
      const candidates = this.buildSnapLines(item)
      let best = proposedStartMs
      let minDelta = SNAP_TOLERANCE_MS + 1

      for (const line of candidates) {
        const delta = Math.abs(line.ms - proposedStartMs)
        if (delta < minDelta) {
          minDelta = delta
          best = line.ms
        }
      }

      return minDelta <= SNAP_TOLERANCE_MS ? best : proposedStartMs
    },

    buildSnapLines(item: TimelineItem): SnapLine[] {
      const trackItems = this.timeline.items.filter((entry) => entry.trackId === item.trackId && entry.id !== item.id)
      return trackItems.flatMap((entry) => [
        { ms: entry.startMs, sourceItemId: entry.id },
        { ms: entry.endMs, sourceItemId: entry.id }
      ])
    },

    resolveTrackOverlap(item: TimelineItem, proposedStartMs: number, duration: number): number {
      const trackItems = this.timeline.items
        .filter((entry) => entry.trackId === item.trackId && entry.id !== item.id)
        .sort(sortByStart)

      let currentStart = proposedStartMs
      for (const other of trackItems) {
        const currentEnd = currentStart + duration
        if (currentEnd <= other.startMs || currentStart >= other.endMs) {
          continue
        }
        currentStart = other.endMs
      }
      return currentStart
    },

    recalculateDuration() {
      this.timeline.durationMs = this.timeline.items.reduce((max, item) => Math.max(max, item.endMs), 0)
    }
  }
})

export function createDefaultTimeline(): TimelineProject {
  return {
    tracks: [
      { id: VIDEO_TRACK_ID, type: 'video', name: '视频轨', locked: false, muted: false },
      { id: AUDIO_TRACK_ID, type: 'audio', name: '音频轨', locked: false, muted: false },
      { id: SUBTITLE_TRACK_ID, type: 'subtitle', name: '字幕轨', locked: false, muted: false },
      { id: STICKER_TRACK_ID, type: 'sticker', name: '贴纸轨', locked: false, muted: false }
    ],
    items: [],
    durationMs: 0,
    fps: 30,
    aspectRatio: '16:9'
  }
}

function safeParse(value: string): EditorProjectDraft | null {
  try {
    return JSON.parse(value) as EditorProjectDraft
  } catch {
    return null
  }
}

function normalizeTimeline(value: TimelineProject): TimelineProject {
  const tracks = Array.isArray(value.tracks) ? value.tracks.slice() : []
  const defaults = createDefaultTimeline().tracks
  for (const item of defaults) {
    if (!tracks.some((track) => track.id === item.id)) {
      tracks.push(item)
    }
  }
  return {
    tracks,
    items: Array.isArray(value.items) ? value.items : [],
    durationMs: Number.isFinite(value.durationMs) ? Math.max(0, value.durationMs) : 0,
    fps: Number.isFinite(value.fps) ? value.fps : 30,
    aspectRatio: value.aspectRatio ?? '16:9'
  }
}

export function migrateLegacyClipsToTimeline(clips: TimelineClip[]): TimelineProject {
  const timeline = createDefaultTimeline()
  let cursor = 0
  clips
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((clip) => {
      const sourceInMs = Math.floor(clip.startSec * 1000)
      const sourceOutMs = Math.floor(clip.endSec * 1000)
      const duration = Math.max(100, sourceOutMs - sourceInMs)
      const startMs = cursor
      const endMs = startMs + duration

      timeline.items.push({
        id: clip.id || crypto.randomUUID(),
        trackId: VIDEO_TRACK_ID,
        mediaId: clip.mediaId,
        label: clip.mediaName,
        startMs,
        endMs,
        sourceInMs,
        sourceOutMs,
        gain: clip.volume,
        speed: clip.speed,
        visualAdjust: normalizeVisualAdjust(clip.visualAdjust),
        transition: normalizeTransition(clip.transition),
        color: '#6a9cff'
      })
      timeline.items.push({
        id: crypto.randomUUID(),
        trackId: AUDIO_TRACK_ID,
        mediaId: clip.mediaId,
        label: clip.mediaName,
        startMs,
        endMs,
        sourceInMs,
        sourceOutMs,
        gain: clip.volume,
        speed: clip.speed,
        color: '#5bc58c'
      })

      cursor = endMs
    })

  timeline.durationMs = cursor
  return timeline
}

function getTrackType(timeline: TimelineProject, trackId: string): TimelineTrack['type'] | 'video' {
  return timeline.tracks.find((track) => track.id === trackId)?.type ?? 'video'
}

function sortByStart(a: TimelineItem, b: TimelineItem): number {
  return a.startMs - b.startMs
}

function createDefaultVisualAdjust() {
  return {
    brightness: 0,
    contrast: 1,
    saturation: 1
  }
}

function createDefaultTransitionAdjust() {
  return {
    fadeInMs: 0,
    fadeOutMs: 0
  }
}

function createDefaultStickerAdjust() {
  return {
    xPct: 0.5,
    yPct: 0.2,
    scale: 1,
    opacity: 1
  }
}

function normalizeVisualAdjust(value: TimelineItem['visualAdjust']) {
  return {
    ...createDefaultVisualAdjust(),
    ...(value ?? {})
  }
}

function normalizeTransition(value: TimelineItem['transition']) {
  return {
    ...createDefaultTransitionAdjust(),
    ...(value ?? {})
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function cloneTimeline(value: TimelineProject): TimelineProject {
  return JSON.parse(JSON.stringify(value)) as TimelineProject
}

