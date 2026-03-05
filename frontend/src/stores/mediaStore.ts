import { defineStore } from 'pinia'
import { db } from '../db/indexedDb'
import type { MediaAsset } from '../types/media'

export const useMediaStore = defineStore('media', {
  state: () => ({
    items: [] as MediaAsset[],
    loading: false
  }),
  actions: {
    async load() {
      this.loading = true
      this.items = await db.mediaAssets.orderBy('createdAt').reverse().toArray()
      this.loading = false
    },
    async add(file: File) {
      const metadata = await readMeta(file)
      const now = new Date().toISOString()
      const item: MediaAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        file,
        size: file.size,
        durationSeconds: metadata.durationSeconds,
        width: metadata.width,
        height: metadata.height,
        createdAt: now,
        lastUsedAt: now
      }

      await db.mediaAssets.add(item)
      this.items.unshift(item)
    },
    async remove(id: string) {
      await db.mediaAssets.delete(id)
      this.items = this.items.filter((item) => item.id !== id)
    },
    async touch(id: string) {
      const item = this.items.find((entry) => entry.id === id)
      if (!item) {
        return
      }

      item.lastUsedAt = new Date().toISOString()
      await db.mediaAssets.put(item)
    }
  }
})

function readMeta(file: File): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve({
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      })
    }
    video.onerror = () => reject(new Error('读取视频元数据失败'))
    video.src = URL.createObjectURL(file)
  })
}
