import type { SplitPiece } from '../../types/split'

export interface SplitPlanPoint {
  index: number
  startSec: number
  endSec: number
  targetEndSec: number
}

export function createSplitPlan(durationSeconds: number, segmentSeconds: number): SplitPlanPoint[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('durationSeconds must be > 0')
  }

  if (!Number.isInteger(segmentSeconds) || segmentSeconds <= 0) {
    throw new Error('segmentSeconds must be a positive integer')
  }

  const totalSegments = Math.ceil(durationSeconds / segmentSeconds)
  const plan: SplitPlanPoint[] = []

  for (let i = 0; i < totalSegments; i += 1) {
    const start = i * segmentSeconds
    const end = Math.min((i + 1) * segmentSeconds, durationSeconds)
    plan.push({
      index: i + 1,
      startSec: start,
      endSec: end,
      targetEndSec: end
    })
  }

  return plan
}

export function toSplitPieces(points: SplitPlanPoint[], baseName: string): SplitPiece[] {
  return points.map((point) => ({
    index: point.index,
    startSec: point.startSec,
    endSec: point.endSec,
    outputName: `${baseName}_${String(point.index).padStart(3, '0')}_${toTimeCode(point.startSec)}-${toTimeCode(point.endSec)}.mp4`
  }))
}

export function toTimeCode(value: number): string {
  return Math.floor(value).toString().padStart(3, '0')
}
