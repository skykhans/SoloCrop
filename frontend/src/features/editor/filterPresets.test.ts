import { describe, expect, it } from 'vitest'
import { FILTER_PRESETS, normalizeTransitionAdjust } from './filterPresets'

describe('filterPresets', () => {
  it('contains multiple presets', () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(4)
    expect(FILTER_PRESETS.map((item) => item.name)).toContain('胶片')
  })

  it('normalizes transition values', () => {
    const result = normalizeTransitionAdjust({ fadeInMs: -10.2, fadeOutMs: 165.9 })
    expect(result).toEqual({ fadeInMs: 0, fadeOutMs: 165 })
  })
})
