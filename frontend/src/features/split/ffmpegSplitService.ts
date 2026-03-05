import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { SplitMode, SplitResult } from '../../types/split'
import { alignCutPoints, buildEstimatedKeyframes } from './keyframeAlign'
import { createSplitPlan, toSplitPieces } from './planner'

const INPUT_FILE = 'input.mp4'
const LOCAL_CORE_BASE = '/ffmpeg'
const LOCAL_WORKER_PATH = '/ffmpeg/worker/worker.js'

let ffmpeg: FFmpeg | null = null

export interface SplitExecutionOptions {
  file: File
  segmentSeconds: number
  mode: SplitMode
  onProgress?: (value: number, currentPiece: number, totalPieces: number) => void
}

interface OutputBlob {
  fileName: string
  blob: Blob
}

export async function splitVideoByDuration(options: SplitExecutionOptions): Promise<{ result: SplitResult; outputs: OutputBlob[] }> {
  const start = performance.now()
  const durationSeconds = await getVideoDuration(options.file)
  const plan = createSplitPlan(durationSeconds, options.segmentSeconds)
  const targetCutPoints = plan.slice(0, -1).map((p) => p.targetEndSec)
  const baseName = removeExt(options.file.name)
  const plannedPieces = toSplitPieces(plan, baseName)
  options.onProgress?.(0, 0, plannedPieces.length)

  const engine = await getFFmpeg()
  await engine.writeFile(INPUT_FILE, await fetchFile(options.file))

  const keyframes = buildEstimatedKeyframes(durationSeconds)

  const cutPoints =
    options.mode === 'fast_keyframe'
      ? alignCutPoints(targetCutPoints, {
          durationSeconds,
          toleranceSec: 1,
          keyframes
        })
      : targetCutPoints.map((point) => ({ targetSec: point, actualSec: point, strategy: 'exact' as const }))

  const fastEdges = buildStableEdges(cutPoints.map((point) => point.actualSec), durationSeconds)
  const shouldFallbackToPreciseEdges =
    options.mode === 'fast_keyframe' && fastEdges.length - 1 < plannedPieces.length

  const actualEdges = shouldFallbackToPreciseEdges
    ? [0, ...targetCutPoints, durationSeconds]
    : fastEdges

  const pieces = toSplitPieces(buildPointsFromEdges(actualEdges), baseName)

  const outputs: OutputBlob[] = []
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i]
    const outputName = `piece_${i + 1}.mp4`

    const command =
      options.mode === 'fast_keyframe'
        ? [
            '-ss',
            String(piece.startSec),
            '-i',
            INPUT_FILE,
            '-t',
            String(piece.endSec - piece.startSec),
            '-c',
            'copy',
            outputName
          ]
        : [
            '-ss',
            String(piece.startSec),
            '-i',
            INPUT_FILE,
            '-t',
            String(piece.endSec - piece.startSec),
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-c:a',
            'aac',
            outputName
          ]

    let code = await engine.exec(command, options.mode === 'fast_keyframe' ? 15000 : 60000)
    if (code !== 0 && options.mode === 'fast_keyframe') {
      code = await engine.exec([
        '-ss',
        String(piece.startSec),
        '-i',
        INPUT_FILE,
        '-t',
        String(piece.endSec - piece.startSec),
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-c:a',
        'aac',
        outputName
      ], 60000)
    }
    if (code !== 0) {
      throw new Error(`FFmpeg 导出失败，错误码 ${code}`)
    }
    const data = await engine.readFile(outputName)
    if (typeof data === 'string') {
      throw new Error('Unexpected ffmpeg output format')
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

    const strictBytes = Uint8Array.from(bytes)

    outputs.push({
      fileName: piece.outputName,
      blob: new Blob([strictBytes], { type: 'video/mp4' })
    })

    await engine.deleteFile(outputName)
    options.onProgress?.((i + 1) / pieces.length, i + 1, pieces.length)
  }

  await engine.deleteFile(INPUT_FILE)

  const maxDeviationMs = cutPoints.reduce((max, point) => {
    const deviation = Math.abs(point.actualSec - point.targetSec) * 1000
    return Math.max(max, deviation)
  }, 0)

  const result: SplitResult = {
    pieces,
    cutPoints,
    elapsedMs: Math.round(performance.now() - start),
    maxDeviationMs
  }

  return { result, outputs }
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg
  }

  const instance = new FFmpeg()
  const origin = window.location.origin
  const localCoreURL = `${origin}${LOCAL_CORE_BASE}/ffmpeg-core.js`
  const localWasmURL = `${origin}${LOCAL_CORE_BASE}/ffmpeg-core.wasm`
  const localWorkerURL = `${origin}${LOCAL_WORKER_PATH}`
  await assertRuntimeAssetsReady(localCoreURL, localWasmURL, localWorkerURL)
  try {
    await withTimeout(
      instance.load({ classWorkerURL: localWorkerURL, coreURL: localCoreURL, wasmURL: localWasmURL }),
      60000,
      'FFmpeg 初始化失败(v3)：load timeout'
    )
  } catch (error) {
    throw new Error(
      `FFmpeg 初始化失败(v3)：${toErr(error)} | worker=${localWorkerURL} | core=${localCoreURL} | wasm=${localWasmURL}`
    )
  }

  ffmpeg = instance
  return instance
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => reject(new Error('Unable to read video metadata'))
    video.src = URL.createObjectURL(file)
  })
}

function removeExt(value: string): string {
  const idx = value.lastIndexOf('.')
  if (idx < 0) {
    return value
  }

  return value.slice(0, idx)
}

function buildStableEdges(points: number[], durationSeconds: number): number[] {
  const result: number[] = [0]
  const epsilon = 0.001

  for (const point of points) {
    const safePoint = Math.max(point, result[result.length - 1] + epsilon)
    if (safePoint < durationSeconds - epsilon) {
      result.push(Number(safePoint.toFixed(3)))
    }
  }

  result.push(durationSeconds)
  return result
}

function buildPointsFromEdges(edges: number[]) {
  return edges.slice(0, -1).map((startSec, idx) => ({
    index: idx + 1,
    startSec,
    endSec: edges[idx + 1],
    targetEndSec: edges[idx + 1]
  }))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function assertRuntimeAssetsReady(coreURL: string, wasmURL: string, workerURL: string): Promise<void> {
  const [coreRes, wasmRes, workerRes] = await Promise.all([
    fetch(coreURL, { method: 'HEAD' }),
    fetch(wasmURL, { method: 'HEAD' }),
    fetch(workerURL, { method: 'HEAD' })
  ])

  if (!coreRes.ok || !wasmRes.ok || !workerRes.ok) {
    throw new Error('FFmpeg 本地运行时文件缺失，请检查 public/ffmpeg 及 public/ffmpeg/worker')
  }
}

function toErr(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
