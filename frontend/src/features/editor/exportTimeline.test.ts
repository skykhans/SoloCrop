import { describe, expect, it } from 'vitest'
import { classifyExportError, ExportCanceledError, resolveExportPreset, toSrt, validateExportPlan } from './exportTimeline'

describe('resolveExportPreset', () => {
  it('returns source preset metadata', () => {
    expect(resolveExportPreset('source')).toEqual({
      label: '源分辨率',
      scaleHeight: null
    })
  })

  it('uses localized source label', () => {
    expect(resolveExportPreset('source').label).toBe('源分辨率')
  })

  it('returns 720p preset metadata', () => {
    expect(resolveExportPreset('p720')).toEqual({
      label: '720p',
      scaleHeight: 720
    })
  })

  it('returns 1080p preset metadata', () => {
    expect(resolveExportPreset('p1080')).toEqual({
      label: '1080p',
      scaleHeight: 1080
    })
  })
})

describe('validateExportPlan', () => {
  it('warns and suggests fallback preset for merged+source with multiple media', () => {
    const result = validateExportPlan({
      clips: [
        { id: '1', mediaId: 'a', mediaName: 'a.mp4', startSec: 0, endSec: 1, volume: 1, speed: 1, position: 0 },
        { id: '2', mediaId: 'b', mediaName: 'b.mp4', startSec: 0, endSec: 1, volume: 1, speed: 1, position: 1 }
      ],
      mediaFiles: {
        a: new File(['x'], 'a.mp4'),
        b: new File(['y'], 'b.mp4')
      },
      mode: 'merged',
      preset: 'source',
      bitrate: 'auto'
    })

    expect(result.errors).toHaveLength(0)
    expect(result.warnings[0]).toContain('合并导出 + 源分辨率')
    expect(result.autoFixPreset).toBe('p720')
  })

  it('exports cancellable error type', () => {
    const error = new ExportCanceledError()
    expect(error.name).toBe('ExportCanceledError')
    expect(error.message).toBe('导出已取消')
  })

  it('classifies non-retryable parameter errors', () => {
    const result = classifyExportError(new Error('目录写入权限未授予'))
    expect(result.retryable).toBe(false)
  })

  it('classifies timeout-like errors as retryable', () => {
    const result = classifyExportError(new Error('导出超时'))
    expect(result.retryable).toBe(true)
  })

  it('builds srt text from subtitle segments', () => {
    const srt = toSrt([
      { id: '1', startMs: 0, endMs: 1000, text: '第一行', confidence: 0.8, enabled: true },
      { id: '2', startMs: 1200, endMs: 2400, text: '第二行', confidence: 0.9, enabled: false }
    ])
    expect(srt).toContain('00:00:00,000 --> 00:00:01,000')
    expect(srt).toContain('第一行')
    expect(srt).not.toContain('第二行')
  })
})
