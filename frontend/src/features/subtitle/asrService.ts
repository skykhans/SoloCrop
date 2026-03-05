import type { SubtitleSegment, SubtitleSettings } from '../../types/editor'

export interface AsrModelInfo {
  name: 'tiny' | 'base'
  sizeMb: number
}

export const ASR_MODELS: AsrModelInfo[] = [
  { name: 'tiny', sizeMb: 78 },
  { name: 'base', sizeMb: 142 }
]

const MODEL_STORAGE_KEY = 'solocrop.subtitle.model.cache'

export async function ensureModel(settings: SubtitleSettings): Promise<void> {
  const installed = getInstalledModels()
  if (installed.includes(settings.model)) {
    return
  }

  // Lightweight local simulation for Whisper WASM model bootstrap.
  await wait(settings.model === 'tiny' ? 1200 : 2200)
  setInstalledModels([...installed, settings.model])
}

export async function transcribeLocal(
  file: File,
  settings: SubtitleSettings,
  onProgress?: (value: number) => void
): Promise<SubtitleSegment[]> {
  await ensureModel(settings)
  const durationMs = await readDurationMs(file)
  const chunkMs = 4000
  const segments: SubtitleSegment[] = []
  const count = Math.max(1, Math.ceil(durationMs / chunkMs))

  for (let i = 0; i < count; i += 1) {
    const startMs = i * chunkMs
    const endMs = Math.min(durationMs, startMs + chunkMs)
    await wait(280)
    segments.push({
      id: crypto.randomUUID(),
      startMs,
      endMs,
      text: `自动字幕片段 ${i + 1}`,
      confidence: settings.model === 'base' ? 0.86 : 0.74,
      enabled: true
    })
    onProgress?.((i + 1) / count)
  }

  return segments
}

function readDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      const duration = Math.max(1000, Math.floor(video.duration * 1000))
      URL.revokeObjectURL(video.src)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('无法读取视频时长，自动字幕失败'))
    }
  })
}

function getInstalledModels(): Array<'tiny' | 'base'> {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(MODEL_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as Array<'tiny' | 'base'>
    return Array.isArray(parsed) ? parsed.filter((item) => item === 'tiny' || item === 'base') : []
  } catch {
    return []
  }
}

function setInstalledModels(models: Array<'tiny' | 'base'>): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(Array.from(new Set(models))))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
