export interface TimelineClip {
  id: string
  mediaId: string
  mediaName: string
  startSec: number
  endSec: number
  volume: number
  speed: number
  position: number
  visualAdjust?: VisualAdjust
  transition?: TransitionAdjust
}

export type ExportPreset = 'source' | 'p720' | 'p1080'
export type ExportMode = 'pieces' | 'merged' | 'final'
export type ExportBitratePreset = 'auto' | '2000k' | '4000k' | '8000k'

export type TimelineTrackType = 'video' | 'audio' | 'subtitle' | 'sticker'

export interface VisualAdjust {
  brightness: number
  contrast: number
  saturation: number
}

export interface TransitionAdjust {
  fadeInMs: number
  fadeOutMs: number
}

export interface StickerAdjust {
  xPct: number
  yPct: number
  scale: number
  opacity: number
}

export type StickerVariant = 'text' | 'pill' | 'badge' | 'burst'

export interface StickerStyle {
  variant: StickerVariant
  bgColor: string
  textColor: string
  borderColor: string
}

export interface TemplateStickerPreset {
  text: string
  startOffsetMs: number
  durationMs: number
  adjust?: Partial<StickerAdjust>
  style?: Partial<StickerStyle>
}

export interface TemplateSubtitlePreset {
  text: string
  startOffsetMs: number
  durationMs: number
}

export interface TemplatePreset {
  id: string
  name: string
  description: string
  source?: 'builtin' | 'custom'
  visualAdjust: Partial<VisualAdjust>
  transition: Partial<TransitionAdjust>
  stickers: TemplateStickerPreset[]
  subtitles: TemplateSubtitlePreset[]
}

export interface TimelineTrack {
  id: string
  type: TimelineTrackType
  name: string
  locked: boolean
  muted: boolean
}

export interface TimelineItem {
  id: string
  trackId: string
  mediaId?: string
  label: string
  startMs: number
  endMs: number
  sourceInMs: number
  sourceOutMs: number
  gain?: number
  speed?: number
  text?: string
  color?: string
  visualAdjust?: VisualAdjust
  transition?: TransitionAdjust
  stickerAdjust?: StickerAdjust
  stickerStyle?: StickerStyle
}

export interface PlayheadState {
  currentMs: number
  playing: boolean
}

export interface SnapLine {
  ms: number
  sourceItemId: string
}

export interface SelectionRange {
  startMs: number
  endMs: number
}

export interface TimelineProject {
  tracks: TimelineTrack[]
  items: TimelineItem[]
  durationMs: number
  fps: number
  aspectRatio: '16:9' | '9:16' | '1:1'
}

export interface SubtitleSegment {
  id: string
  startMs: number
  endMs: number
  text: string
  confidence: number
  enabled: boolean
}

export interface SubtitleSettings {
  model: 'tiny' | 'base'
  language: 'zh' | 'auto'
}

export interface EditorProjectDraft {
  projectId: string
  clips: TimelineClip[]
  playheadSec: number
  selectedClipId: string | null
  exportPreset: ExportPreset
  exportMode: ExportMode
  exportBitrate: ExportBitratePreset
  timeline?: TimelineProject
  subtitleSegments?: SubtitleSegment[]
  subtitleSettings?: SubtitleSettings
}

