import { defineStore } from 'pinia'
import type { SplitMode, SplitResult } from '../types/split'
import {
  chooseDownloadDirectory,
  downloadBatch,
  getDownloadPreference,
  isDirectoryOutputSupported,
  useBrowserDownload
} from '../features/split/download'
import { splitVideoByDuration } from '../features/split/ffmpegSplitService'

export const useSplitStore = defineStore('split', {
  state: () => ({
    status: 'idle' as 'idle' | 'running' | 'success' | 'failed',
    progress: 0,
    currentPiece: 0,
    totalPieces: 0,
    stageText: '',
    errorMessage: '',
    mode: 'fast_keyframe' as SplitMode,
    directoryOutputSupported: isDirectoryOutputSupported(),
    downloadMode: getDownloadPreference().mode as 'browser' | 'directory',
    downloadDirectoryName: getDownloadPreference().directoryName as string | null,
    downloadUsedMode: 'browser' as 'browser' | 'directory',
    latestResult: null as SplitResult | null
  }),
  actions: {
    async runSplit(file: File, segmentSeconds: number) {
      try {
        this.status = 'running'
        this.progress = 0
        this.currentPiece = 0
        this.totalPieces = 0
        this.stageText = '初始化中...'
        this.errorMessage = ''

        const { result, outputs } = await splitVideoByDuration({
          file,
          segmentSeconds,
          mode: this.mode,
          onProgress: (value, current, total) => {
            this.progress = value
            this.currentPiece = current
            this.totalPieces = total
            this.stageText = current === 0 ? '准备分段中...' : '正在导出...'
          }
        })

        this.downloadUsedMode = await downloadBatch(outputs)
        this.latestResult = result
        this.stageText = '完成'
        this.status = 'success'
      } catch (error) {
        this.status = 'failed'
        this.stageText = ''
        this.errorMessage = error instanceof Error ? error.message : '切割失败'
      }
    },
    setMode(mode: SplitMode) {
      this.mode = mode
    },
    async setDownloadDirectory() {
      const name = await chooseDownloadDirectory()
      this.downloadMode = 'directory'
      this.downloadDirectoryName = name
    },
    setBrowserDownloadMode() {
      useBrowserDownload()
      this.downloadMode = 'browser'
      this.downloadDirectoryName = null
    }
  }
})
