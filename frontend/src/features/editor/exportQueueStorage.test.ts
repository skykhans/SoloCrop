import { describe, expect, it } from 'vitest'
import { loadExportQueue, saveExportQueue, type ExportQueueRecord } from './exportQueueStorage'

describe('exportQueueStorage', () => {
  it('marks pending and running tasks as cancelled after reload', () => {
    const records: ExportQueueRecord[] = [
      {
        id: '1',
        clips: [],
        pipelineVersion: 2,
        mode: 'pieces',
        preset: 'source',
        bitrate: 'auto',
        retryCount: 0,
        maxRetries: 2,
        autoRetry: true,
        retryable: true,
        status: 'pending',
        progress: 0,
        current: 0,
        total: 3,
        message: '等待执行',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        clips: [],
        pipelineVersion: 2,
        mode: 'merged',
        preset: 'p720',
        bitrate: '2000k',
        retryCount: 1,
        maxRetries: 2,
        autoRetry: true,
        retryable: true,
        status: 'running',
        progress: 0.4,
        current: 2,
        total: 5,
        message: '导出中',
        createdAt: '2026-01-01T00:00:01.000Z'
      }
    ]

    saveExportQueue(records)
    const restored = loadExportQueue()
    expect(restored[0].status).toBe('cancelled')
    expect(restored[1].status).toBe('cancelled')
    expect(restored[0].message).toContain('页面刷新')
  })

  it('restores clips snapshot when present', () => {
    const records: ExportQueueRecord[] = [
      {
        id: '3',
        clips: [{ id: 'c1', mediaId: 'm1', mediaName: 'a.mp4', startSec: 0, endSec: 1, volume: 1, speed: 1, position: 0 }],
        pipelineVersion: 2,
        mode: 'pieces',
        preset: 'source',
        bitrate: 'auto',
        retryCount: 2,
        maxRetries: 2,
        autoRetry: false,
        retryable: false,
        status: 'failed',
        progress: 0.2,
        current: 1,
        total: 3,
        message: '失败',
        createdAt: '2026-01-01T00:00:02.000Z'
      }
    ]

    saveExportQueue(records)
    const restored = loadExportQueue()
    expect(restored[0].clips).toHaveLength(1)
    expect(restored[0].clips[0].mediaName).toBe('a.mp4')
    expect(restored[0].retryCount).toBe(2)
    expect(restored[0].retryable).toBe(false)
  })
})
