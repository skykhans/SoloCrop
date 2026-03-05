import type { ExportBitratePreset, ExportMode, ExportPreset, TimelineClip } from '../../types/editor'

const STORAGE_KEY = 'solocrop.editor.export.queue'

export type ExportTaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface ExportQueueRecord {
  id: string
  clips: TimelineClip[]
  pipelineVersion: number
  mode: ExportMode
  preset: ExportPreset
  bitrate: ExportBitratePreset
  retryCount: number
  maxRetries: number
  autoRetry: boolean
  retryable: boolean
  status: ExportTaskStatus
  progress: number
  current: number
  total: number
  message: string
  createdAt: string
}

export function saveExportQueue(records: ExportQueueRecord[]): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function loadExportQueue(): ExportQueueRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as ExportQueueRecord[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((item) => !!item?.id)
      .map((item) => {
        const clips = Array.isArray((item as { clips?: unknown }).clips) ? ((item as { clips: TimelineClip[] }).clips) : []
        const pipelineVersion = Number.isFinite((item as { pipelineVersion?: number }).pipelineVersion)
          ? Number((item as { pipelineVersion: number }).pipelineVersion)
          : 1
        const retryCount = Number.isFinite((item as { retryCount?: number }).retryCount)
          ? Math.max(0, Number((item as { retryCount: number }).retryCount))
          : 0
        const maxRetries = Number.isFinite((item as { maxRetries?: number }).maxRetries)
          ? Math.max(0, Number((item as { maxRetries: number }).maxRetries))
          : 0
        const autoRetry = Boolean((item as { autoRetry?: boolean }).autoRetry)
        const retryable = (item as { retryable?: boolean }).retryable !== false
        if (item.status === 'pending' || item.status === 'running') {
          return {
            ...item,
            clips,
            pipelineVersion,
            retryCount,
            maxRetries,
            autoRetry,
            retryable,
            status: 'cancelled',
            message: '页面刷新，任务已中断'
          } as ExportQueueRecord
        }
        return {
          ...item,
          clips,
          pipelineVersion,
          retryCount,
          maxRetries,
          autoRetry,
          retryable
        } as ExportQueueRecord
      })
  } catch {
    return []
  }
}
