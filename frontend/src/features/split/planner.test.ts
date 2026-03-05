import { describe, expect, it } from 'vitest'
import { createSplitPlan } from './planner'

describe('createSplitPlan', () => {
  it('creates 3 pieces for 70/30', () => {
    const result = createSplitPlan(70, 30)

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ startSec: 0, endSec: 30 })
    expect(result[1]).toMatchObject({ startSec: 30, endSec: 60 })
    expect(result[2]).toMatchObject({ startSec: 60, endSec: 70 })
  })

  it('creates 1 piece when duration is shorter than segment', () => {
    const result = createSplitPlan(29, 30)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startSec: 0, endSec: 29 })
  })

  it('throws when segment is invalid', () => {
    expect(() => createSplitPlan(70, 0)).toThrowError()
  })
})
