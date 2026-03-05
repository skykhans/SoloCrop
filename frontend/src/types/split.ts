export type SplitMode = 'fast_keyframe' | 'precise'

export interface SplitRequest {
  fileId: string
  durationSeconds: number
  segmentSeconds: number
  mode: SplitMode
}

export interface SplitCutPoint {
  targetSec: number
  actualSec: number
  strategy: 'exact' | 'nearby_keyframe' | 'next_keyframe'
}

export interface SplitPiece {
  index: number
  startSec: number
  endSec: number
  outputName: string
}

export interface SplitResult {
  pieces: SplitPiece[]
  cutPoints: SplitCutPoint[]
  elapsedMs: number
  maxDeviationMs: number
}
