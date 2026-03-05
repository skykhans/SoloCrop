export interface CaptureCoverOptions {
  file: File
  timeSec: number
  format: 'png' | 'jpeg'
  quality?: number
}

export async function captureCoverFrame(options: CaptureCoverOptions): Promise<Blob> {
  const { file, format } = options
  const quality = typeof options.quality === 'number' ? options.quality : 0.92
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'

  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  const objectUrl = URL.createObjectURL(file)
  try {
    video.src = objectUrl
    await once(video, 'loadedmetadata', 12000)
    const safeTime = clampTime(options.timeSec, video.duration)
    await seek(video, safeTime)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1
    canvas.height = video.videoHeight || 1
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('无法创建画布上下文')
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    return await toBlob(canvas, mimeType, quality)
  } finally {
    video.pause()
    video.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

function clampTime(timeSec: number, durationSec: number): number {
  if (!Number.isFinite(timeSec)) {
    return 0
  }
  const max = Math.max(0, durationSec - 0.05)
  return Math.min(Math.max(0, timeSec), max)
}

function once(target: HTMLVideoElement, event: 'loadedmetadata', timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('读取视频信息超时'))
    }, timeoutMs)

    const onDone = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('读取视频信息失败'))
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      target.removeEventListener(event, onDone)
      target.removeEventListener('error', onError)
    }

    target.addEventListener(event, onDone, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

function seek(video: HTMLVideoElement, targetSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('视频跳转超时'))
    }, 10000)

    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('视频跳转失败'))
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = targetSec
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('生成封面失败'))
          return
        }
        resolve(blob)
      },
      type,
      quality
    )
  })
}
