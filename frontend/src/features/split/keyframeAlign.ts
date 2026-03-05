import type { SplitCutPoint } from '../../types/split'

export interface AlignOptions {
  toleranceSec?: number
  durationSeconds: number
  keyframes: number[]
}

export function alignCutPoints(targetCutPoints: number[], options: AlignOptions): SplitCutPoint[] {
  const tolerance = options.toleranceSec ?? 1
  const keyframes = normalize(options.keyframes, options.durationSeconds)

  return targetCutPoints
    .filter((point) => point > 0 && point < options.durationSeconds)
    .map((targetSec) => {
      const inWindow = keyframes.filter((k) => Math.abs(k - targetSec) <= tolerance)

      if (inWindow.length > 0) {
        const nearest = inWindow.reduce((best, current) => {
          const currentDiff = Math.abs(current - targetSec)
          const bestDiff = Math.abs(best - targetSec)
          if (currentDiff < bestDiff) {
            return current
          }
          if (currentDiff === bestDiff && current > best) {
            return current
          }
          return best
        })

        return {
          targetSec,
          actualSec: nearest,
          strategy: nearest === targetSec ? 'exact' : 'nearby_keyframe'
        }
      }

      const next = keyframes.find((k) => k > targetSec)
      if (next !== undefined) {
        return {
          targetSec,
          actualSec: next,
          strategy: 'next_keyframe'
        }
      }

      return {
        targetSec,
        actualSec: targetSec,
        strategy: 'exact'
      }
    })
}

function normalize(keyframes: number[], durationSeconds: number): number[] {
  const result = keyframes
    .filter((value) => value >= 0 && value <= durationSeconds)
    .map((value) => Number(value.toFixed(3)))

  if (!result.includes(0)) {
    result.unshift(0)
  }

  if (!result.includes(durationSeconds)) {
    result.push(durationSeconds)
  }

  return [...new Set(result)].sort((a, b) => a - b)
}

export function buildEstimatedKeyframes(durationSeconds: number, gopSec = 2): number[] {
  const keyframes: number[] = [0]

  for (let t = gopSec; t < durationSeconds; t += gopSec) {
    keyframes.push(Number(t.toFixed(3)))
  }

  keyframes.push(durationSeconds)
  return keyframes
}
