import { FFmpeg } from '@ffmpeg/ffmpeg'
import { normalizeStickerStyle } from './stickerLibrary'
import type { ExportBitratePreset, ExportPreset, SubtitleSegment, TimelineClip, TimelineProject } from '../../types/editor'

const LOCAL_CORE_BASE = '/ffmpeg'

let ffmpeg: FFmpeg | null = null

interface OutputBlob {
  fileName: string
  blob: Blob
}

export interface ExportValidation {
  errors: string[]
  warnings: string[]
  autoFixPreset?: ExportPreset
}

export class ExportCanceledError extends Error {
  constructor() {
    super('导出已取消')
    this.name = 'ExportCanceledError'
  }
}

export interface ExportErrorInfo {
  retryable: boolean
  reason: string
}

export interface ExportTimelineOptions {
  projectId: string
  clips: TimelineClip[]
  mediaFiles: Record<string, File>
  preset: ExportPreset
  bitrate: ExportBitratePreset
  signal?: AbortSignal
  onProgress?: (value: number, current: number, total: number) => void
}

export interface ExportFinalVideoOptions {
  projectId: string
  timeline: TimelineProject
  subtitleSegments: SubtitleSegment[]
  mediaFiles: Record<string, File>
  preset: ExportPreset
  bitrate: ExportBitratePreset
  signal?: AbortSignal
  onProgress?: (value: number, current: number, total: number) => void
}

export function validateExportPlan(options: {
  clips: TimelineClip[]
  mediaFiles: Record<string, File>
  mode: 'pieces' | 'merged' | 'final'
  preset: ExportPreset
  bitrate: ExportBitratePreset
}): ExportValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!options.clips.length) {
    errors.push('时间线为空，无法导出')
    return { errors, warnings }
  }

  for (const clip of options.clips) {
    if (!options.mediaFiles[clip.mediaId]) {
      errors.push(`缺少素材文件：${clip.mediaName}`)
      break
    }
    if (clip.endSec <= clip.startSec) {
      errors.push(`片段区间无效：${clip.mediaName}`)
      break
    }
  }

  const mediaIds = new Set(options.clips.map((item) => item.mediaId))
  if ((options.mode === 'merged' || options.mode === 'final') && options.preset === 'source' && mediaIds.size > 1) {
    warnings.push('合并导出 + 源分辨率 下存在多素材，可能因分辨率不一致失败')
    return { errors, warnings, autoFixPreset: 'p720' }
  }

  if ((options.mode === 'merged' || options.mode === 'final') && options.bitrate === '8000k') {
    warnings.push('合并导出 + 8Mbps 会显著增加耗时与文件体积')
  }

  if (options.preset !== 'source' && options.bitrate === 'auto') {
    warnings.push('当前为重编码路径，建议按清晰度需求选择固定码率')
  }

  return { errors, warnings }
}

export async function exportFinalVideo(options: ExportFinalVideoOptions): Promise<OutputBlob> {
  throwIfAborted(options.signal)
  const timelineClips = toClipsFromTimeline(options.timeline)
  const stickerOverlays = toStickerOverlays(options.timeline)
  if (!timelineClips.length) {
    throw new Error('时间轴无可导出视频片段')
  }

  const merged = await exportTimelineMerged({
    projectId: options.projectId,
    clips: timelineClips,
    mediaFiles: options.mediaFiles,
    preset: options.preset,
    bitrate: options.bitrate,
    signal: options.signal,
    onProgress: (value, current, total) => {
      const mappedTotal = total + (options.subtitleSegments.length || stickerOverlays.length ? 1 : 0)
      options.onProgress?.(value * (total / mappedTotal), current, mappedTotal)
    }
  })
  if (!options.subtitleSegments.length && !stickerOverlays.length) {
    return {
      ...merged,
      fileName: `${sanitizeName(options.projectId)}_timeline_final.mp4`
    }
  }

  const engine = await getFFmpeg()
  const inputName = 'final_base.mp4'
  const subtitleName = 'final_subtitle.srt'
  const outputName = 'final_fx.mp4'
  try {
    await engine.writeFile(inputName, new Uint8Array(await merged.blob.arrayBuffer()))
    if (options.subtitleSegments.length) {
      await engine.writeFile(subtitleName, new TextEncoder().encode(toSrt(options.subtitleSegments)))
    }

    const videoFilters: string[] = []
    if (options.subtitleSegments.length) {
      const escapedSub = subtitleName.replace(/:/g, '\\:')
      videoFilters.push(`subtitles=${escapedSub}`)
    }
    if (stickerOverlays.length) {
      videoFilters.push(...stickerOverlays.map((item) => buildStickerDrawtextFilter(item)))
    }

    const command = [
      '-i',
      inputName,
      '-vf',
      videoFilters.join(','),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-c:a',
      'copy'
    ] as string[]
    if (options.bitrate !== 'auto') {
      command.push('-b:v', options.bitrate)
    }
    command.push(outputName)

    const code = await execWithAbort(engine, command, 180000, options.signal)
    if (code !== 0) {
      throw new Error(`字幕烧录失败，错误码 ${code}`)
    }
    const data = await engine.readFile(outputName)
    if (typeof data === 'string') {
      throw new Error('字幕烧录输出格式错误')
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    options.onProgress?.(1, 2, 2)
    return {
      fileName: `${sanitizeName(options.projectId)}_timeline_fx_final.mp4`,
      blob: new Blob([Uint8Array.from(bytes)], { type: 'video/mp4' })
    }
  } finally {
    await safeDelete(engine, inputName)
    if (options.subtitleSegments.length) {
      await safeDelete(engine, subtitleName)
    }
    await safeDelete(engine, outputName)
  }
}

export function classifyExportError(error: unknown): ExportErrorInfo {
  if (error instanceof ExportCanceledError) {
    return { retryable: false, reason: '任务被手动取消' }
  }

  const message = error instanceof Error ? error.message : String(error ?? '未知错误')
  const nonRetryableKeywords = [
    '缺少素材',
    '无效',
    '不支持',
    '权限',
    '未授予',
    '本地 ffmpeg 运行时文件缺失',
    '导出参数'
  ]
  if (nonRetryableKeywords.some((keyword) => message.includes(keyword))) {
    return { retryable: false, reason: '参数或环境问题，建议先修复后再试' }
  }

  const retryableKeywords = ['超时', 'network', 'Network', 'fetch', '中断']
  if (retryableKeywords.some((keyword) => message.includes(keyword))) {
    return { retryable: true, reason: '可能是临时异常，可稍后重试' }
  }

  return { retryable: true, reason: '未知异常，建议重试一次' }
}

export async function exportTimelineClips(options: ExportTimelineOptions): Promise<OutputBlob[]> {
  throwIfAborted(options.signal)
  if (!options.clips.length) {
    throw new Error('时间线没有可导出的片段')
  }

  const engine = await getFFmpeg()
  const outputs: OutputBlob[] = []
  const total = options.clips.length
  options.onProgress?.(0, 0, total)

  for (let i = 0; i < options.clips.length; i += 1) {
    throwIfAborted(options.signal)
    const clip = options.clips[i]
    const source = options.mediaFiles[clip.mediaId]
    if (!source) {
      throw new Error(`缺少素材文件：${clip.mediaName}`)
    }

    const inputName = `editor_piece_input_${i + 1}.mp4`
    const outputName = `editor_piece_output_${i + 1}.mp4`
    await engine.writeFile(inputName, new Uint8Array(await source.arrayBuffer()))

    const command = buildSegmentCommand({
      clip,
      inputName,
      outputName,
      preset: options.preset,
      bitrate: options.bitrate,
      forceReencode: false
    })
    const code = await execWithAbort(engine, command, 120000, options.signal)
    if (code !== 0) {
      await safeDelete(engine, inputName)
      await safeDelete(engine, outputName)
      throw new Error(`导出失败，错误码 ${code}（${clip.mediaName}）`)
    }

    const data = await engine.readFile(outputName)
    if (typeof data === 'string') {
      await safeDelete(engine, inputName)
      await safeDelete(engine, outputName)
      throw new Error('导出输出格式错误')
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    outputs.push({
      fileName: `${options.projectId}_clip_${String(i + 1).padStart(3, '0')}_${sanitizeName(clip.mediaName)}_${toSec(clip.startSec)}-${toSec(clip.endSec)}.mp4`,
      blob: new Blob([Uint8Array.from(bytes)], { type: 'video/mp4' })
    })

    await safeDelete(engine, inputName)
    await safeDelete(engine, outputName)
    options.onProgress?.((i + 1) / total, i + 1, total)
  }

  return outputs
}

export async function exportTimelineMerged(options: ExportTimelineOptions): Promise<OutputBlob> {
  throwIfAborted(options.signal)
  if (!options.clips.length) {
    throw new Error('时间线没有可导出的片段')
  }
  if (options.preset === 'source') {
    const mediaIds = new Set(options.clips.map((item) => item.mediaId))
    if (mediaIds.size > 1) {
      throw new Error('合并导出在“源分辨率”预设下要求同一素材，建议切换到 720p 或 1080p')
    }
  }

  const engine = await getFFmpeg()
  const total = options.clips.length + 1
  options.onProgress?.(0, 0, total)
  const segmentFiles: string[] = []

  try {
    for (let i = 0; i < options.clips.length; i += 1) {
      throwIfAborted(options.signal)
      const clip = options.clips[i]
      const source = options.mediaFiles[clip.mediaId]
      if (!source) {
        throw new Error(`缺少素材文件：${clip.mediaName}`)
      }

      const inputName = `editor_merge_input_${i + 1}.mp4`
      const outputName = `editor_merge_seg_${String(i + 1).padStart(3, '0')}.mp4`
      await engine.writeFile(inputName, new Uint8Array(await source.arrayBuffer()))

      const command = buildSegmentCommand({
        clip,
        inputName,
        outputName,
        preset: options.preset,
        bitrate: options.bitrate,
        forceReencode: true
      })
      const code = await execWithAbort(engine, command, 120000, options.signal)
      await safeDelete(engine, inputName)

      if (code !== 0) {
        await safeDelete(engine, outputName)
        throw new Error(`合并导出片段生成失败，错误码 ${code}（${clip.mediaName}）`)
      }

      segmentFiles.push(outputName)
      options.onProgress?.((i + 1) / total, i + 1, total)
    }

    const listFile = 'editor_merge_list.txt'
    const listContent = segmentFiles.map((name) => `file '${name}'`).join('\n')
    await engine.writeFile(listFile, new TextEncoder().encode(listContent))

    const mergedName = 'editor_merged_output.mp4'
    const mergeCode = await execWithAbort(engine, ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', mergedName], 180000, options.signal)
    if (mergeCode !== 0) {
      await safeDelete(engine, listFile)
      await safeDelete(engine, mergedName)
      throw new Error(`合并导出失败，错误码 ${mergeCode}`)
    }

    const data = await engine.readFile(mergedName)
    if (typeof data === 'string') {
      throw new Error('合并导出输出格式错误')
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    const output: OutputBlob = {
      fileName: `${sanitizeName(options.projectId)}_timeline_merged_${options.preset}.mp4`,
      blob: new Blob([Uint8Array.from(bytes)], { type: 'video/mp4' })
    }

    await safeDelete(engine, listFile)
    await safeDelete(engine, mergedName)
    options.onProgress?.(1, total, total)
    return output
  } finally {
    for (const name of segmentFiles) {
      await safeDelete(engine, name)
    }
  }
}

export function resolveExportPreset(preset: ExportPreset): { label: string; scaleHeight: number | null } {
  if (preset === 'p720') {
    return { label: '720p', scaleHeight: 720 }
  }
  if (preset === 'p1080') {
    return { label: '1080p', scaleHeight: 1080 }
  }
  return { label: '源分辨率', scaleHeight: null }
}

function buildSegmentCommand(options: {
  clip: TimelineClip
  inputName: string
  outputName: string
  preset: ExportPreset
  bitrate: ExportBitratePreset
  forceReencode: boolean
}): string[] {
  const { clip, inputName, outputName, preset, bitrate, forceReencode } = options
  const duration = Number((clip.endSec - clip.startSec).toFixed(3))
  if (duration <= 0) {
    throw new Error(`片段时长无效：${clip.mediaName}`)
  }

  const base = ['-ss', String(clip.startSec), '-i', inputName, '-t', String(duration)]
  const speed = Number(clip.speed.toFixed(3))
  const volume = Number(clip.volume.toFixed(3))
  const scaleHeight = resolveExportPreset(preset).scaleHeight
  const visualAdjust = normalizeVisualAdjust(clip.visualAdjust)
  const transition = normalizeTransition(clip.transition)
  const hasVisualAdjust =
    visualAdjust.brightness !== 0 ||
    visualAdjust.contrast !== 1 ||
    visualAdjust.saturation !== 1
  const hasTransition = transition.fadeInMs > 0 || transition.fadeOutMs > 0

  if (!forceReencode && speed === 1 && volume === 1 && !scaleHeight && !hasVisualAdjust && !hasTransition) {
    return [...base, '-c', 'copy', outputName]
  }

  const videoFilters: string[] = []
  if (speed !== 1) {
    videoFilters.push(`setpts=${(1 / speed).toFixed(6)}*PTS`)
  }
  if (scaleHeight) {
    videoFilters.push(`scale=-2:${scaleHeight}`)
  }
  if (hasVisualAdjust) {
    videoFilters.push(
      `eq=brightness=${visualAdjust.brightness.toFixed(3)}:contrast=${visualAdjust.contrast.toFixed(3)}:saturation=${visualAdjust.saturation.toFixed(3)}`
    )
  }
  if (transition.fadeInMs > 0) {
    const fadeInSec = Math.min(duration, transition.fadeInMs / 1000)
    if (fadeInSec > 0) {
      videoFilters.push(`fade=t=in:st=0:d=${fadeInSec.toFixed(3)}`)
    }
  }
  if (transition.fadeOutMs > 0) {
    const fadeOutSec = Math.min(Math.max(0, duration - 0.05), transition.fadeOutMs / 1000)
    if (fadeOutSec > 0) {
      const fadeStart = Math.max(0, duration - fadeOutSec)
      videoFilters.push(`fade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeOutSec.toFixed(3)}`)
    }
  }

  const audioFilters: string[] = []
  if (speed !== 1) {
    audioFilters.push(`atempo=${speed}`)
  }
  if (volume !== 1) {
    audioFilters.push(`volume=${volume}`)
  }

  const command = [...base]
  if (videoFilters.length) {
    command.push('-filter:v', videoFilters.join(','))
  }
  if (audioFilters.length) {
    command.push('-filter:a', audioFilters.join(','))
  }

  const encodeVideo = forceReencode || videoFilters.length
  const encodeAudio = forceReencode || audioFilters.length

  if (encodeVideo) {
    command.push('-c:v', 'libx264', '-preset', 'fast')
    if (bitrate !== 'auto') {
      command.push('-b:v', bitrate)
    }
  } else {
    command.push('-c:v', 'copy')
  }

  if (encodeAudio) {
    command.push('-c:a', 'aac')
  } else {
    command.push('-c:a', 'copy')
  }

  command.push(outputName)
  return command
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg
  }

  const instance = new FFmpeg()
  const origin = window.location.origin
  const coreURL = `${origin}${LOCAL_CORE_BASE}/ffmpeg-core.js`
  const wasmURL = `${origin}${LOCAL_CORE_BASE}/ffmpeg-core.wasm`
  const workerURL = `${origin}/ffmpeg/worker/worker.js`

  await assertRuntimeAssetsReady(coreURL, wasmURL, workerURL)
  await instance.load({ classWorkerURL: workerURL, coreURL, wasmURL })
  ffmpeg = instance
  return instance
}

async function execWithAbort(engine: FFmpeg, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<number> {
  throwIfAborted(signal)
  if (!signal) {
    return engine.exec(args, timeoutMs)
  }

  return Promise.race([
    engine.exec(args, timeoutMs),
    new Promise<number>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          try {
            engine.terminate()
          } catch {
            // ignore
          }
          ffmpeg = null
          reject(new ExportCanceledError())
        },
        { once: true }
      )
    })
  ])
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ExportCanceledError()
  }
}

async function assertRuntimeAssetsReady(coreURL: string, wasmURL: string, workerURL: string): Promise<void> {
  const [coreRes, wasmRes, workerRes] = await Promise.all([
    fetch(coreURL, { method: 'HEAD' }),
    fetch(wasmURL, { method: 'HEAD' }),
    fetch(workerURL, { method: 'HEAD' })
  ])

  if (!coreRes.ok || !wasmRes.ok || !workerRes.ok) {
    throw new Error('本地 ffmpeg 运行时文件缺失，请执行 npm run sync:ffmpeg-core')
  }
}

async function safeDelete(engine: FFmpeg, path: string): Promise<void> {
  try {
    await engine.deleteFile(path)
  } catch {
    // ignore
  }
}

function toSec(value: number): string {
  return Math.floor(value).toString().padStart(3, '0')
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_')
}

function toClipsFromTimeline(timeline: TimelineProject): TimelineClip[] {
  const videoTrackIds = timeline.tracks.filter((item) => item.type === 'video').map((item) => item.id)
  const videoItems = timeline.items
    .filter((item) => videoTrackIds.includes(item.trackId) && item.mediaId)
    .sort((a, b) => a.startMs - b.startMs)
  return videoItems.map((item, index) => ({
    id: item.id,
    mediaId: item.mediaId!,
    mediaName: item.label,
    startSec: Number((item.sourceInMs / 1000).toFixed(3)),
    endSec: Number((item.sourceOutMs / 1000).toFixed(3)),
    volume: Number((item.gain ?? 1).toFixed(2)),
    speed: Number((item.speed ?? 1).toFixed(2)),
    position: index,
    visualAdjust: normalizeVisualAdjust(item.visualAdjust),
    transition: normalizeTransition(item.transition)
  }))
}

interface StickerOverlay {
  text: string
  startSec: number
  endSec: number
  xPct: number
  yPct: number
  scale: number
  opacity: number
  variant: 'text' | 'pill' | 'badge' | 'burst'
  bgColor: string
  textColor: string
  borderColor: string
}

function toStickerOverlays(timeline: TimelineProject): StickerOverlay[] {
  const stickerTrackIds = timeline.tracks.filter((item) => item.type === 'sticker').map((item) => item.id)
  return timeline.items
    .filter((item) => stickerTrackIds.includes(item.trackId))
    .map((item) => {
      const adjust = item.stickerAdjust ?? { xPct: 0.5, yPct: 0.2, scale: 1, opacity: 1 }
      const style = normalizeStickerStyle(item.stickerStyle)
      return {
        text: (item.text || item.label || 'STICKER').slice(0, 24),
        startSec: Number((item.startMs / 1000).toFixed(3)),
        endSec: Number((item.endMs / 1000).toFixed(3)),
        xPct: clamp(adjust.xPct, 0, 1),
        yPct: clamp(adjust.yPct, 0, 1),
        scale: clamp(adjust.scale, 0.5, 3),
        opacity: clamp(adjust.opacity, 0.1, 1),
        variant: style.variant,
        bgColor: style.bgColor,
        textColor: style.textColor,
        borderColor: style.borderColor
      }
    })
    .filter((item) => item.endSec > item.startSec)
}

function buildStickerDrawtextFilter(item: StickerOverlay): string {
  const text = escapeDrawtext(item.text)
  const xExpr = `(w*${item.xPct.toFixed(4)}-text_w/2)`
  const yExpr = `(h*${item.yPct.toFixed(4)}-text_h/2)`
  const fontSize = Math.max(18, Math.floor(42 * item.scale))
  const enableExpr = `between(t,${item.startSec.toFixed(3)},${item.endSec.toFixed(3)})`
  const textColor = toFfmpegColor(item.textColor, item.opacity)
  const borderColor = toFfmpegColor(item.borderColor, Math.min(1, item.opacity + 0.1))
  const boxColor = toFfmpegColor(item.bgColor, Math.max(0.2, item.opacity * 0.9))

  const filters: string[] = []
  if (item.variant !== 'text') {
    const boxW = Math.max(110, Math.floor(220 * item.scale))
    const boxH = Math.max(42, Math.floor(74 * item.scale))
    const boxX = `(w*${item.xPct.toFixed(4)}-${Math.floor(boxW / 2)})`
    const boxY = `(h*${item.yPct.toFixed(4)}-${Math.floor(boxH / 2)})`
    filters.push(
      `drawbox=x=${boxX}:y=${boxY}:w=${boxW}:h=${boxH}:color=${boxColor}:t=fill:enable='${enableExpr}'`
    )
  }

  filters.push(
    `drawtext=text='${text}':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=${textColor}:borderw=2:bordercolor=${borderColor}:enable='${enableExpr}'`
  )
  return filters.join(',')
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function toFfmpegColor(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 255, g: 255, b: 255 }
  return `0x${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}@${clamp(alpha, 0, 1).toFixed(3)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = (hex || '').trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(`${normalized[0]}${normalized[0]}`, 16),
      g: Number.parseInt(`${normalized[1]}${normalized[1]}`, 16),
      b: Number.parseInt(`${normalized[2]}${normalized[2]}`, 16)
    }
  }
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    }
  }
  return null
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.floor(value))).toString(16).padStart(2, '0')
}

function normalizeVisualAdjust(value: TimelineClip['visualAdjust']) {
  return {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    ...(value ?? {})
  }
}

function normalizeTransition(value: TimelineClip['transition']) {
  return {
    fadeInMs: 0,
    fadeOutMs: 0,
    ...(value ?? {})
  }
}

export function toSrt(segments: SubtitleSegment[]): string {
  return segments
    .filter((item) => item.enabled)
    .sort((a, b) => a.startMs - b.startMs)
    .map((item, index) => `${index + 1}\n${fmt(item.startMs)} --> ${fmt(item.endMs)}\n${item.text || ' '}\n`)
    .join('\n')
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const hh = Math.floor(total / 3600000)
  const mm = Math.floor((total % 3600000) / 60000)
  const ss = Math.floor((total % 60000) / 1000)
  const mmm = total % 1000
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(mmm).padStart(3, '0')}`
}
