<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import PreviewPlayer from '../components/editor/PreviewPlayer.vue'
import SubtitleTrack from '../components/editor/SubtitleTrack.vue'
import TimelineRuler from '../components/editor/TimelineRuler.vue'
import TimelineTrack from '../components/editor/TimelineTrack.vue'
import { useEditorStore } from '../stores/editorStore'
import { useMediaStore } from '../stores/mediaStore'
import { useSubtitleStore } from '../stores/subtitleStore'
import { useTimelineStore } from '../stores/timelineStore'
import {
  classifyExportError,
  ExportCanceledError,
  exportFinalVideo,
  resolveExportPreset
} from '../features/editor/exportTimeline'
import { loadExportQueue, saveExportQueue, type ExportQueueRecord, type ExportTaskStatus } from '../features/editor/exportQueueStorage'
import { FILTER_PRESETS } from '../features/editor/filterPresets'
import { STICKER_LIBRARY } from '../features/editor/stickerLibrary'
import { downloadBatch } from '../features/split/download'
import { resolveTemplatePreset, TEMPLATE_PRESETS } from '../features/template/templateLibrary'
import type { ExportBitratePreset, ExportMode, ExportPreset, StickerVariant, TimelineClip } from '../types/editor'

interface ExportTaskItem {
  id: string
  clips: TimelineClip[]
  pipelineVersion: number
  mode: ExportMode
  preset: ExportPreset
  bitrate: ExportBitratePreset
  retryCount: number
  maxRetries: number
  autoRetry: boolean
  retryable: boolean
  status: ExportTaskStatus
  progress: number
  current: number
  total: number
  message: string
  createdAt: string
}

const EXPORT_RETRY_PREF_KEY = 'solocrop.editor.export.retry.pref'
const route = useRoute()
const projectId = computed(() => route.params.projectId?.toString() || 'default')
const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const timelineStore = useTimelineStore()
const subtitleStore = useSubtitleStore()

const activeTab = ref('timeline')
const selectedMediaId = ref('')
const pxPerSecond = computed(() => 80 * timelineStore.zoom)
const autoRetryEnabled = ref(true)
const maxAutoRetries = ref(2)
const subtitleOffsetSec = ref(0)
const selectedTemplateId = ref(TEMPLATE_PRESETS[0]?.id ?? '')

const exportQueue = ref<ExportTaskItem[]>([])
const processingQueue = ref(false)
const currentAbortController = ref<AbortController | null>(null)
const exportProgress = ref(0)
const exportCurrent = ref(0)
const exportTotal = ref(0)

onMounted(async () => {
  const tasks: Array<Promise<unknown>> = [
    editorStore.init(projectId.value),
    timelineStore.init(projectId.value)
  ]
  if (!mediaStore.items.length) {
    tasks.unshift(mediaStore.load())
  }
  await Promise.all(tasks)
  const records = loadExportQueue()
  if (records.length) {
    exportQueue.value = records.map((item) => ({ ...item }))
  }
  const raw = window.localStorage.getItem(EXPORT_RETRY_PREF_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { autoRetryEnabled?: boolean; maxAutoRetries?: number }
      autoRetryEnabled.value = parsed.autoRetryEnabled !== false
      maxAutoRetries.value = Number.isFinite(parsed.maxAutoRetries) ? Math.max(0, Math.min(5, Number(parsed.maxAutoRetries))) : 2
    } catch {
      // ignore
    }
  }
})

watch(
  exportQueue,
  (queue) => {
    const records: ExportQueueRecord[] = queue.map((item) => ({
      id: item.id,
      clips: item.clips,
      pipelineVersion: item.pipelineVersion,
      mode: item.mode,
      preset: item.preset,
      bitrate: item.bitrate,
      retryCount: item.retryCount,
      maxRetries: item.maxRetries,
      autoRetry: item.autoRetry,
      retryable: item.retryable,
      status: item.status,
      progress: item.progress,
      current: item.current,
      total: item.total,
      message: item.message,
      createdAt: item.createdAt
    }))
    saveExportQueue(records)
  },
  { deep: true }
)

watch([autoRetryEnabled, maxAutoRetries], ([enabled, retries]) => {
  window.localStorage.setItem(
    EXPORT_RETRY_PREF_KEY,
    JSON.stringify({
      autoRetryEnabled: enabled,
      maxAutoRetries: retries
    })
  )
})

const selectedMedia = computed(() => mediaStore.items.find((item) => item.id === selectedMediaId.value) ?? null)
const editorReady = computed(() => !mediaStore.loading && !timelineStore.loading)
const previewVideoItems = computed(() => timelineStore.videoItems)
const previewStickerItems = computed(() => timelineStore.stickerItems)
const selectedVideoItem = computed(() => timelineStore.selectedVideoItem)
const selectedStickerItem = computed(() => timelineStore.selectedStickerItem)
const selectedVisualAdjust = computed(() => selectedVideoItem.value?.visualAdjust ?? { brightness: 0, contrast: 1, saturation: 1 })
const selectedTransition = computed(() => selectedVideoItem.value?.transition ?? { fadeInMs: 0, fadeOutMs: 0 })
const selectedStickerAdjust = computed(() => selectedStickerItem.value?.stickerAdjust ?? { xPct: 0.5, yPct: 0.2, scale: 1, opacity: 1 })
const selectedStickerText = computed(() => selectedStickerItem.value?.text ?? '')
const selectedStickerStyle = computed(
  () =>
    selectedStickerItem.value?.stickerStyle ?? {
      variant: 'text' as StickerVariant,
      bgColor: '#ff4d4f',
      textColor: '#ffffff',
      borderColor: '#ffffff'
    }
)
const selectedTemplate = computed(() => resolveTemplatePreset(selectedTemplateId.value))
const stickerVariantOptions: Array<{ value: StickerVariant; label: string }> = [
  { value: 'text', label: '纯文本' },
  { value: 'pill', label: '胶囊' },
  { value: 'badge', label: '角标' },
  { value: 'burst', label: '爆点' }
]
const runningTask = computed(() => exportQueue.value.find((item) => item.status === 'running') ?? null)
const exportPresetOptions: Array<{ value: ExportPreset; label: string }> = [
  { value: 'source', label: '源分辨率' },
  { value: 'p720', label: '720p' },
  { value: 'p1080', label: '1080p' }
]
const exportBitrateOptions: Array<{ value: ExportBitratePreset; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: '2000k', label: '2Mbps' },
  { value: '4000k', label: '4Mbps' },
  { value: '8000k', label: '8Mbps' }
]

function addSelectedMediaToTimeline() {
  if (!editorReady.value) {
    ElMessage.warning('编辑器初始化中，请稍候')
    return
  }
  const target = selectedMedia.value ?? mediaStore.items[0] ?? null
  if (!target) {
    ElMessage.error('请先选择素材')
    return
  }
  if (!selectedMedia.value) {
    selectedMediaId.value = target.id
  }
  try {
    timelineStore.addMedia(target)
    ElMessage.success('素材已加入时间轴')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加入时间轴失败')
  }
}

function handleTrackMove(itemId: string, startMs: number) {
  timelineStore.moveItem(itemId, startMs)
}

function handleTrackTrim(itemId: string, edge: 'start' | 'end', ms: number) {
  timelineStore.trimItem(itemId, edge, ms)
}

function togglePlay() {
  timelineStore.setPlaying(!timelineStore.playhead.playing)
}

async function saveProject() {
  await timelineStore.saveDraft({
    exportPreset: editorStore.exportPreset,
    exportMode: editorStore.exportMode,
    exportBitrate: editorStore.exportBitrate,
    subtitleSettings: subtitleStore.settings
  })
  ElMessage.success('工程已保存')
}

async function runAutoSubtitle() {
  const firstVideo = timelineStore.videoItems[0]
  if (!firstVideo?.mediaId) {
    ElMessage.error('请先添加视频到时间轴')
    return
  }
  const media = mediaStore.items.find((item) => item.id === firstVideo.mediaId)
  if (!media) {
    ElMessage.error('找不到对应素材文件')
    return
  }
  try {
    await subtitleStore.runAutoSubtitle(media.file)
    for (const segment of subtitleStore.segments) {
      timelineStore.addSubtitle(segment.startMs, segment.endMs, segment.text)
    }
    ElMessage.success('自动字幕生成完成（本地ASR）')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '自动字幕失败')
  }
}

function applySubtitleOffset() {
  subtitleStore.offsetAll(Math.floor(subtitleOffsetSec.value * 1000))
  ElMessage.success('字幕偏移已应用')
}

async function enqueueFinalExport() {
  const clips = timelineStore.toLegacyClips()
  if (!clips.length) {
    ElMessage.error('时间轴为空，无法导出')
    return
  }
  const task: ExportTaskItem = {
    id: crypto.randomUUID(),
    clips,
    pipelineVersion: 2,
    mode: 'final',
    preset: editorStore.exportPreset,
    bitrate: editorStore.exportBitrate,
    retryCount: 0,
    maxRetries: maxAutoRetries.value,
    autoRetry: autoRetryEnabled.value,
    retryable: true,
    status: 'pending',
    progress: 0,
    current: 0,
    total: 2,
    message: '等待执行',
    createdAt: new Date().toISOString()
  }
  exportQueue.value.unshift(task)
  ElMessage.success('成片导出任务已入队')
  void processExportQueue()
}

function cancelCurrentTask() {
  currentAbortController.value?.abort()
}

function clearFinishedTasks() {
  exportQueue.value = exportQueue.value.filter((item) => item.status === 'running' || item.status === 'pending')
}

function retryTask(taskId: string) {
  const task = exportQueue.value.find((item) => item.id === taskId)
  if (!task || task.status === 'running' || task.status === 'pending') {
    return
  }
  task.status = 'pending'
  task.progress = 0
  task.current = 0
  task.retryCount = 0
  task.maxRetries = maxAutoRetries.value
  task.autoRetry = autoRetryEnabled.value
  task.retryable = true
  task.message = '等待重试'
  void processExportQueue()
}

function retryFailedTasks() {
  const targets = exportQueue.value.filter((item) => item.status === 'failed')
  if (!targets.length) {
    ElMessage.info('没有失败任务')
    return
  }
  for (const task of targets) {
    retryTask(task.id)
  }
}

async function processExportQueue() {
  if (processingQueue.value) {
    return
  }
  processingQueue.value = true
  try {
    while (true) {
      const task = exportQueue.value.find((item) => item.status === 'pending')
      if (!task) {
        break
      }
      await runTask(task)
    }
  } finally {
    processingQueue.value = false
  }
}

async function runTask(task: ExportTaskItem) {
  task.status = 'running'
  task.message = '导出中'
  task.retryable = true
  const abortController = new AbortController()
  currentAbortController.value = abortController

  try {
    const mediaFiles = Object.fromEntries(mediaStore.items.map((item) => [item.id, item.file]))
    const output = await exportFinalVideo({
      projectId: projectId.value,
      timeline: timelineStore.timeline,
      subtitleSegments: subtitleStore.segments,
      mediaFiles,
      preset: task.preset,
      bitrate: task.bitrate,
      signal: abortController.signal,
      onProgress: (value, current, total) => {
        task.progress = value
        task.current = current
        task.total = total
        exportProgress.value = value
        exportCurrent.value = current
        exportTotal.value = total
      }
    })
    const mode = await downloadBatch([output])
    task.status = 'success'
    task.progress = 1
    task.current = task.total
    task.message = mode === 'directory' ? '完成（已写入目录）' : '完成（已下载）'
    ElMessage.success('成片导出完成')
  } catch (error) {
    if (error instanceof ExportCanceledError) {
      task.status = 'cancelled'
      task.message = '已取消'
      ElMessage.warning('导出已取消')
    } else {
      const info = classifyExportError(error)
      task.retryable = info.retryable
      if (task.autoRetry && info.retryable && task.retryCount < task.maxRetries) {
        task.retryCount += 1
        const waitMs = 1000 * (2 ** (task.retryCount - 1))
        task.status = 'pending'
        task.message = `自动重试 ${task.retryCount}/${task.maxRetries}，等待 ${waitMs / 1000}s`
        await wait(waitMs)
      } else {
        task.status = 'failed'
        const detail = error instanceof Error ? error.message : '导出失败'
        task.message = info.retryable ? detail : `${detail}（不可自动重试）`
        ElMessage.error(task.message)
      }
    }
  } finally {
    currentAbortController.value = null
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function taskStatusType(status: ExportTaskStatus): 'info' | 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'pending') return 'info'
  if (status === 'running') return 'primary'
  if (status === 'success') return 'success'
  if (status === 'cancelled') return 'warning'
  return 'danger'
}

function taskStatusLabel(status: ExportTaskStatus): string {
  if (status === 'pending') return '排队中'
  if (status === 'running') return '执行中'
  if (status === 'success') return '成功'
  if (status === 'cancelled') return '已取消'
  return '失败'
}

function fmtMs(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function updateVideoAdjust(field: 'brightness' | 'contrast' | 'saturation', value: number) {
  try {
    timelineStore.updateSelectedVideoAdjust({ [field]: Number(value) })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新滤镜失败')
  }
}

function updateVideoTransition(field: 'fadeInMs' | 'fadeOutMs', sec: number) {
  try {
    const value = Math.max(0, Math.floor(Number(sec) * 1000))
    timelineStore.updateSelectedVideoTransition({ [field]: value })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新转场失败')
  }
}

function applyFilterPreset(presetId: string) {
  const preset = FILTER_PRESETS.find((item) => item.id === presetId)
  if (!preset) {
    ElMessage.error('滤镜预设不存在')
    return
  }
  try {
    timelineStore.applySelectedVideoFilterPreset(preset.visualAdjust)
    ElMessage.success(`已应用滤镜预设：${preset.name}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应用滤镜预设失败')
  }
}

function applyTransitionToAllVideos() {
  try {
    timelineStore.applyTransitionToAllVideos({
      fadeInMs: selectedTransition.value.fadeInMs,
      fadeOutMs: selectedTransition.value.fadeOutMs
    })
    ElMessage.success('已将当前转场参数应用到所有视频片段')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应用失败')
  }
}

function resetVideoEffects() {
  try {
    timelineStore.resetSelectedVideoEffects()
    ElMessage.success('已重置滤镜与转场')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重置失败')
  }
}

function addSticker(text: string) {
  timelineStore.addSticker(text)
  ElMessage.success('贴纸已添加到贴纸轨')
}

function addStickerPreset(itemId: string) {
  const item = STICKER_LIBRARY.find((entry) => entry.id === itemId)
  if (!item) {
    ElMessage.error('贴纸素材不存在')
    return
  }
  timelineStore.addSticker(item.text, undefined, 2000, item.style)
  ElMessage.success(`已添加贴纸：${item.name}`)
}

function updateStickerText(text: string) {
  try {
    timelineStore.updateSelectedStickerText(text)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新贴纸失败')
  }
}

function updateStickerAdjust(field: 'xPct' | 'yPct' | 'scale' | 'opacity', value: number) {
  try {
    timelineStore.updateSelectedStickerAdjust({ [field]: Number(value) })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新贴纸失败')
  }
}

function updateStickerStyle(field: 'variant' | 'bgColor' | 'textColor' | 'borderColor', value: string) {
  try {
    timelineStore.updateSelectedStickerStyle({ [field]: String(value) })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新贴纸样式失败')
  }
}

function applyTemplate() {
  const template = selectedTemplate.value
  if (!template) {
    ElMessage.error('模板不存在')
    return
  }
  try {
    timelineStore.applyTemplatePreset(template)
    ElMessage.success(`已应用模板：${template.name}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应用模板失败')
  }
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <el-select v-model="selectedMediaId" placeholder="选择素材并加入时间轴" style="width: 360px">
        <el-option
          v-for="item in mediaStore.items"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <div style="display: flex; gap: 8px">
        <el-button type="primary" :disabled="!editorReady" @click="addSelectedMediaToTimeline">加入时间轴</el-button>
        <el-button @click="saveProject" :loading="timelineStore.saving" :disabled="!editorReady">保存工程</el-button>
      </div>
    </div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="时间轴" name="timeline">
        <div class="timeline-workspace">
          <PreviewPlayer
            :media-items="previewVideoItems"
            :sticker-items="previewStickerItems"
            :media-assets="mediaStore.items"
            :playhead-ms="timelineStore.playhead.currentMs"
            :playing="timelineStore.playhead.playing"
            @timeupdate="(ms) => timelineStore.setPlayhead(ms)"
            @playingchange="(playing) => timelineStore.setPlaying(playing)"
          />

          <div class="timeline-toolbar">
            <el-button @click="togglePlay">{{ timelineStore.playhead.playing ? '暂停' : '播放' }}</el-button>
            <el-button @click="timelineStore.splitSelectedAtPlayhead">按播放头分割</el-button>
            <el-button @click="timelineStore.deleteSelected">删除选中</el-button>
            <el-button @click="timelineStore.undo">撤销</el-button>
            <el-button @click="timelineStore.redo">重做</el-button>
            <span style="color: #5a6473">播放头：{{ fmtMs(timelineStore.playhead.currentMs) }}</span>
            <el-slider
              :model-value="timelineStore.zoom"
              :min="0.4"
              :max="4"
              :step="0.1"
              style="max-width: 220px; margin-left: auto"
              @input="(value) => timelineStore.setZoom(Number(value))"
            />
          </div>

          <div class="timeline-scroll">
            <TimelineRuler
              :duration-ms="timelineStore.timeline.durationMs"
              :px-per-second="pxPerSecond"
              :playhead-ms="timelineStore.playhead.currentMs"
            />
            <TimelineTrack
              v-for="track in timelineStore.tracks"
              :key="track.id"
              :track="track"
              :items="timelineStore.items.filter((item) => item.trackId === track.id)"
              :selected-item-id="timelineStore.selectedItemId"
              :duration-ms="timelineStore.timeline.durationMs"
              :px-per-second="pxPerSecond"
              @select="(itemId) => timelineStore.selectItem(itemId)"
              @move="handleTrackMove"
              @trim="handleTrackTrim"
            />
          </div>

          <div class="editor-tool-panel" style="margin-top: 10px">
            <div class="export-queue-head">
              <strong>模板系统（首版）</strong>
              <el-button type="primary" plain @click="applyTemplate">应用模板</el-button>
            </div>
            <p style="margin: 0 0 10px; color: #5a6473; font-size: 12px">
              选择模板后可一次性应用滤镜、转场、示例贴纸和字幕到当前时间轴。
            </p>
            <el-select v-model="selectedTemplateId" style="width: 320px; margin-bottom: 10px">
              <el-option
                v-for="item in TEMPLATE_PRESETS"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
            <el-alert
              v-if="selectedTemplate"
              :title="selectedTemplate.description"
              type="info"
              :closable="false"
              show-icon
            />
          </div>

          <div class="editor-tool-panel" style="margin-top: 10px">
            <div class="export-queue-head">
              <strong>滤镜与转场（首版）</strong>
              <el-button text @click="resetVideoEffects" :disabled="!selectedVideoItem">重置</el-button>
            </div>
            <p style="margin: 0 0 10px; color: #5a6473; font-size: 12px">
              选中视频轨片段后可调节亮度/对比度/饱和度与淡入淡出时长，导出成片时生效。
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px">
              <el-button
                v-for="preset in FILTER_PRESETS"
                :key="preset.id"
                size="small"
                :disabled="!selectedVideoItem"
                @click="applyFilterPreset(preset.id)"
              >
                {{ preset.name }}
              </el-button>
            </div>
            <el-form label-width="120px" size="small">
              <el-form-item label="亮度">
                <el-slider
                  :model-value="selectedVisualAdjust.brightness"
                  :min="-1"
                  :max="1"
                  :step="0.01"
                  :disabled="!selectedVideoItem"
                  style="max-width: 420px"
                  @input="(value) => updateVideoAdjust('brightness', Number(value))"
                />
              </el-form-item>
              <el-form-item label="对比度">
                <el-slider
                  :model-value="selectedVisualAdjust.contrast"
                  :min="0.5"
                  :max="2"
                  :step="0.01"
                  :disabled="!selectedVideoItem"
                  style="max-width: 420px"
                  @input="(value) => updateVideoAdjust('contrast', Number(value))"
                />
              </el-form-item>
              <el-form-item label="饱和度">
                <el-slider
                  :model-value="selectedVisualAdjust.saturation"
                  :min="0"
                  :max="3"
                  :step="0.01"
                  :disabled="!selectedVideoItem"
                  style="max-width: 420px"
                  @input="(value) => updateVideoAdjust('saturation', Number(value))"
                />
              </el-form-item>
              <el-form-item label="淡入(s)">
                <el-input-number
                  :model-value="selectedTransition.fadeInMs / 1000"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :disabled="!selectedVideoItem"
                  @change="(value) => updateVideoTransition('fadeInMs', Number(value ?? 0))"
                />
              </el-form-item>
              <el-form-item label="淡出(s)">
                <el-input-number
                  :model-value="selectedTransition.fadeOutMs / 1000"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :disabled="!selectedVideoItem"
                  @change="(value) => updateVideoTransition('fadeOutMs', Number(value ?? 0))"
                />
              </el-form-item>
              <el-form-item label="跨片段转场">
                <el-button size="small" :disabled="!selectedVideoItem" @click="applyTransitionToAllVideos">应用当前淡入淡出到全部视频</el-button>
              </el-form-item>
            </el-form>
          </div>

          <div class="editor-tool-panel" style="margin-top: 10px">
            <div class="export-queue-head">
              <strong>贴纸素材库（首版）</strong>
            </div>
            <p style="margin: 0 0 10px; color: #5a6473; font-size: 12px">
              支持文本贴纸与图形贴纸样式（胶囊/角标/爆点），可单独配置颜色与位置。
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px">
              <el-button @click="addStickerPreset('like-pill')">LIKE</el-button>
              <el-button @click="addStickerPreset('wow-burst')">WOW</el-button>
              <el-button @click="addStickerPreset('new-badge')">NEW</el-button>
              <el-button @click="addStickerPreset('sale-pill')">SALE</el-button>
              <el-button plain @click="addSticker('STICKER')">纯文本</el-button>
            </div>
            <el-form label-width="120px" size="small">
              <el-form-item label="贴纸文本">
                <el-input
                  :model-value="selectedStickerText"
                  maxlength="24"
                  show-word-limit
                  placeholder="选中贴纸后可编辑"
                  :disabled="!selectedStickerItem"
                  style="max-width: 320px"
                  @input="(value) => updateStickerText(String(value))"
                />
              </el-form-item>
              <el-form-item label="样式">
                <el-select
                  :model-value="selectedStickerStyle.variant"
                  placeholder="选择样式"
                  :disabled="!selectedStickerItem"
                  style="max-width: 220px"
                  @change="(value) => updateStickerStyle('variant', String(value))"
                >
                  <el-option
                    v-for="item in stickerVariantOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="背景色">
                <el-color-picker
                  :model-value="selectedStickerStyle.bgColor"
                  :disabled="!selectedStickerItem"
                  @change="(value) => updateStickerStyle('bgColor', String(value || '#ff4d4f'))"
                />
              </el-form-item>
              <el-form-item label="文字色">
                <el-color-picker
                  :model-value="selectedStickerStyle.textColor"
                  :disabled="!selectedStickerItem"
                  @change="(value) => updateStickerStyle('textColor', String(value || '#ffffff'))"
                />
              </el-form-item>
              <el-form-item label="描边色">
                <el-color-picker
                  :model-value="selectedStickerStyle.borderColor"
                  :disabled="!selectedStickerItem"
                  @change="(value) => updateStickerStyle('borderColor', String(value || '#ffffff'))"
                />
              </el-form-item>
              <el-form-item label="横向位置">
                <el-slider
                  :model-value="selectedStickerAdjust.xPct"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  :disabled="!selectedStickerItem"
                  style="max-width: 420px"
                  @input="(value) => updateStickerAdjust('xPct', Number(value))"
                />
              </el-form-item>
              <el-form-item label="纵向位置">
                <el-slider
                  :model-value="selectedStickerAdjust.yPct"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  :disabled="!selectedStickerItem"
                  style="max-width: 420px"
                  @input="(value) => updateStickerAdjust('yPct', Number(value))"
                />
              </el-form-item>
              <el-form-item label="缩放">
                <el-slider
                  :model-value="selectedStickerAdjust.scale"
                  :min="0.5"
                  :max="3"
                  :step="0.01"
                  :disabled="!selectedStickerItem"
                  style="max-width: 420px"
                  @input="(value) => updateStickerAdjust('scale', Number(value))"
                />
              </el-form-item>
              <el-form-item label="透明度">
                <el-slider
                  :model-value="selectedStickerAdjust.opacity"
                  :min="0.1"
                  :max="1"
                  :step="0.01"
                  :disabled="!selectedStickerItem"
                  style="max-width: 420px"
                  @input="(value) => updateStickerAdjust('opacity', Number(value))"
                />
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="字幕" name="subtitle">
        <div class="subtitle-toolbar">
          <el-segmented
            :model-value="subtitleStore.settings.model"
            :options="[
              { label: 'tiny', value: 'tiny' },
              { label: 'base', value: 'base' }
            ]"
            @change="(value) => subtitleStore.setSettings({ model: value as 'tiny' | 'base' })"
          />
          <el-segmented
            :model-value="subtitleStore.settings.language"
            :options="[
              { label: '中文', value: 'zh' },
              { label: '自动', value: 'auto' }
            ]"
            @change="(value) => subtitleStore.setSettings({ language: value as 'zh' | 'auto' })"
          />
          <el-button type="primary" :loading="subtitleStore.running" @click="runAutoSubtitle">自动字幕（本地ASR）</el-button>
          <el-progress v-if="subtitleStore.running" :percentage="Math.round(subtitleStore.progress * 100)" style="width: 180px" />
        </div>
        <div class="subtitle-toolbar">
          <span style="color: #5a6473">整体偏移(s)</span>
          <el-input-number v-model="subtitleOffsetSec" :step="0.1" />
          <el-button @click="applySubtitleOffset">应用偏移</el-button>
        </div>
        <SubtitleTrack
          :segments="subtitleStore.segments"
          @update-text="(id, text) => subtitleStore.updateSegmentText(id, text)"
          @update-range="(id, startMs, endMs) => subtitleStore.updateSegmentRange(id, startMs, endMs)"
          @toggle="(id, enabled) => subtitleStore.setSegmentEnabled(id, enabled)"
        />
      </el-tab-pane>

      <el-tab-pane label="导出" name="export">
        <div class="editor-tool-panel">
          <p style="margin: 0 0 8px; color: #5a6473">导出预设：{{ resolveExportPreset(editorStore.exportPreset).label }}</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
            <el-radio-group :model-value="editorStore.exportPreset" @change="(value) => editorStore.setExportPreset(value as ExportPreset)">
              <el-radio-button v-for="item in exportPresetOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button>
            </el-radio-group>
            <el-radio-group :model-value="editorStore.exportBitrate" @change="(value) => editorStore.setExportBitrate(value as ExportBitratePreset)">
              <el-radio-button v-for="item in exportBitrateOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button>
            </el-radio-group>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px">
            <el-switch v-model="autoRetryEnabled" active-text="自动重试" />
            <span style="color: #5a6473">最大重试次数</span>
            <el-input-number v-model="maxAutoRetries" :min="0" :max="5" :step="1" />
          </div>
          <el-button type="primary" @click="enqueueFinalExport">导出成片（默认）</el-button>
          <el-button v-if="runningTask" type="danger" plain @click="cancelCurrentTask">取消当前任务</el-button>
          <div v-if="runningTask" style="margin-top: 10px">
            <el-progress :percentage="Math.round(exportProgress * 100)" />
            <p style="margin: 6px 0 0; color: #5a6473">执行中：{{ exportCurrent }} / {{ exportTotal }}</p>
          </div>
        </div>

        <div class="editor-tool-panel" style="margin-top: 12px">
          <div class="export-queue-head">
            <strong>导出队列</strong>
            <div>
              <el-button text @click="retryFailedTasks">重试失败任务</el-button>
              <el-button text @click="clearFinishedTasks">清理已完成</el-button>
            </div>
          </div>
          <el-table data-testid="export-queue-table" :data="exportQueue" size="small" max-height="260">
            <el-table-column label="时间" width="96">
              <template #default="scope">{{ scope.row.createdAt.slice(11, 19) }}</template>
            </el-table-column>
            <el-table-column label="模式" width="70">
              <template #default>成片</template>
            </el-table-column>
            <el-table-column label="预设" width="90">
              <template #default="scope">{{ scope.row.preset }}</template>
            </el-table-column>
            <el-table-column label="重试" width="90">
              <template #default="scope">{{ scope.row.retryCount }}/{{ scope.row.maxRetries }}</template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="scope"><el-tag size="small" :type="taskStatusType(scope.row.status)">{{ taskStatusLabel(scope.row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="信息" min-width="180">
              <template #default="scope">{{ scope.row.message }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="scope">
                <el-button
                  v-if="scope.row.status === 'failed' || scope.row.status === 'cancelled'"
                  text
                  @click="retryTask(scope.row.id)"
                >
                  重试
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
