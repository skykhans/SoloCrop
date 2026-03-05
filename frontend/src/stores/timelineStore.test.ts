import { describe, expect, it } from 'vitest'
import { createDefaultTimeline, migrateLegacyClipsToTimeline } from './timelineStore'

describe('timeline migration', () => {
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
})
