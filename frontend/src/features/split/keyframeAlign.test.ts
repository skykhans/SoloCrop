import { describe, expect, it } from 'vitest'
import { alignCutPoints } from './keyframeAlign'

describe('alignCutPoints', () => {
  it('uses nearby keyframe in tolerance window', () => {
    const points = alignCutPoints([30], {
      durationSeconds: 70,
      toleranceSec: 1,
      keyframes: [0, 29.7, 60, 70]
    })

    expect(points[0]).toMatchObject({ targetSec: 30, actualSec: 29.7, strategy: 'nearby_keyframe' })
  })

  it('falls forward to next keyframe when not found in tolerance', () => {
    const points = alignCutPoints([30], {
      durationSeconds: 70,
      toleranceSec: 0.5,
      keyframes: [0, 31.4, 60, 70]
    })

    expect(points[0]).toMatchObject({ targetSec: 30, actualSec: 31.4, strategy: 'next_keyframe' })
  })

  it('prefers forward keyframe on equal distance to avoid zero-length piece', () => {
    const points = alignCutPoints([1], {
      durationSeconds: 2,
      toleranceSec: 1,
      keyframes: [0, 2]
    })

    expect(points[0]).toMatchObject({ targetSec: 1, actualSec: 2, strategy: 'nearby_keyframe' })
  })
})
