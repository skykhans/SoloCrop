import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultTimeline, migrateLegacyClipsToTimeline, useTimelineStore } from './timelineStore'

describe('timeline migration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates default tracks', () => {
    const timeline = createDefaultTimeline()
    expect(timeline.tracks.map((item) => item.type)).toEqual(['video', 'audio', 'subtitle', 'sticker'])
  })

  it('migrates legacy clips into video/audio tracks', () => {
    const timeline = migrateLegacyClipsToTimeline([
      {
        id: 'c1',
        mediaId: 'm1',
        mediaName: 'demo.mp4',
        startSec: 2,
        endSec: 5,
        volume: 1,
        speed: 1,
        position: 0
      }
    ])

    const videoItems = timeline.items.filter((item) => item.trackId === 'video-main')
    const audioItems = timeline.items.filter((item) => item.trackId === 'audio-main')
    expect(videoItems).toHaveLength(1)
    expect(audioItems).toHaveLength(1)
    expect(videoItems[0].sourceInMs).toBe(2000)
    expect(videoItems[0].sourceOutMs).toBe(5000)
  })

  it('captures a reusable custom template from the current timeline', () => {
    const store = useTimelineStore()
    store.addMedia({
      id: 'm1',
      name: 'demo.mp4',
      file: new File(['demo'], 'demo.mp4', { type: 'video/mp4' }),
      size: 1024,
      durationSeconds: 6,
      width: 1920,
      height: 1080,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    })
    store.updateSelectedVideoAdjust({ brightness: 0.2, contrast: 1.1, saturation: 1.3 })
    store.updateSelectedVideoTransition({ fadeInMs: 300, fadeOutMs: 400 })
    store.addSticker('WOW', 500, 1200, { variant: 'burst', bgColor: '#ffb300' })
    store.addSubtitle(700, 1800, 'Hello world')

    const template = store.captureTemplatePreset('My Template', 'Saved from editor state')

    expect(template.source).toBe('custom')
    expect(template.name).toBe('My Template')
    expect(template.visualAdjust).toMatchObject({ brightness: 0.2, contrast: 1.1, saturation: 1.3 })
    expect(template.transition).toMatchObject({ fadeInMs: 300, fadeOutMs: 400 })
    expect(template.stickers).toHaveLength(1)
    expect(template.stickers[0]).toMatchObject({ text: 'WOW', startOffsetMs: 500, durationMs: 1200 })
    expect(template.subtitles).toHaveLength(1)
    expect(template.subtitles[0]).toMatchObject({ text: 'Hello world', startOffsetMs: 700, durationMs: 1100 })
  })

  it('syncs subtitle segments into the subtitle track and snapshot', () => {
    const store = useTimelineStore()
    store.syncSubtitlesFromSegments([
      { id: 's1', startMs: 100, endMs: 800, text: '第一条', confidence: 0.9, enabled: true },
      { id: 's2', startMs: 900, endMs: 1500, text: '第二条', confidence: 0.8, enabled: false }
    ])

    expect(store.subtitleItems).toHaveLength(2)
    expect(store.subtitleItems[0]).toMatchObject({ id: 's1', text: '第一条', startMs: 100, endMs: 800, color: '#f6b24f' })
    expect(store.subtitleItems[1]).toMatchObject({ id: 's2', text: '第二条', startMs: 900, endMs: 1500, color: '#c8ced8' })
    expect(store.subtitleSegmentsSnapshot).toHaveLength(2)
    expect(store.timeline.durationMs).toBe(1500)
  })
})
