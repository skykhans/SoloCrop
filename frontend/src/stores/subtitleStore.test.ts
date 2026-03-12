import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSubtitleStore } from './subtitleStore'

describe('subtitle store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a manual subtitle segment', () => {
    const store = useSubtitleStore()
    store.addSegment(500, 1800, '手动字幕')

    expect(store.segments).toHaveLength(1)
    expect(store.segments[0]).toMatchObject({
      startMs: 500,
      endMs: 1800,
      text: '手动字幕',
      enabled: true
    })
  })

  it('duplicates a subtitle segment after the source range', () => {
    const store = useSubtitleStore()
    store.loadFromSegments([
      { id: 's1', startMs: 100, endMs: 600, text: '原字幕', confidence: 0.8, enabled: true }
    ])

    store.duplicateSegment('s1')

    expect(store.segments).toHaveLength(2)
    expect(store.segments[1]).toMatchObject({
      startMs: 600,
      endMs: 1100,
      text: '原字幕',
      enabled: true
    })
  })

  it('removes a subtitle segment by id', () => {
    const store = useSubtitleStore()
    store.loadFromSegments([
      { id: 's1', startMs: 100, endMs: 600, text: '原字幕', confidence: 0.8, enabled: true }
    ])

    store.removeSegment('s1')

    expect(store.segments).toEqual([])
  })
})
