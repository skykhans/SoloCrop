import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimelineTrack from './TimelineTrack.vue'

describe('TimelineTrack', () => {
  it('emits create with track id and computed start time on canvas double click', async () => {
    const wrapper = mount(TimelineTrack, {
      props: {
        track: { id: 'subtitle-main', type: 'subtitle', name: '字幕轨', locked: false, muted: false },
        items: [],
        pxPerSecond: 100,
        selectedItemId: null,
        durationMs: 5000
      }
    })

    const canvas = wrapper.get('.timeline-track-canvas')
    Object.defineProperty(canvas.element, 'getBoundingClientRect', {
      value: () => ({ left: 20, top: 0, width: 800, height: 40, right: 820, bottom: 40, x: 20, y: 0, toJSON: () => ({}) })
    })

    await canvas.trigger('dblclick', { clientX: 270 })

    expect(wrapper.emitted('create')).toEqual([['subtitle-main', 2500]])
  })
})
