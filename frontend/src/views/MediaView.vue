<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useMediaStore } from '../stores/mediaStore'
import { useSplitStore } from '../stores/splitStore'
import type { SplitMode } from '../types/split'

const mediaStore = useMediaStore()
const splitStore = useSplitStore()

const dialogVisible = ref(false)
const selectedMediaId = ref('')
const segmentSeconds = ref(30)

const selectedMedia = computed(() => mediaStore.items.find((item) => item.id === selectedMediaId.value) ?? null)

onMounted(async () => {
  await mediaStore.load()
})

async function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) {
    return
  }

  for (const file of Array.from(input.files)) {
    if (!file.type.includes('mp4')) {
      ElMessage.warning(`${file.name} 不是 MP4 文件，已跳过`)
      continue
    }

    await mediaStore.add(file)
  }

  ElMessage.success('素材已导入')
  input.value = ''
}

function openSplitDialog(mediaId: string) {
  selectedMediaId.value = mediaId
  dialogVisible.value = true
}

async function chooseDirectory() {
  try {
    await splitStore.setDownloadDirectory()
    ElMessage.success(`输出目录已设置为：${splitStore.downloadDirectoryName}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '设置输出目录失败')
  }
}

function useBrowserDownloadMode() {
  splitStore.setBrowserDownloadMode()
  ElMessage.success('已切换为浏览器下载模式')
}

async function runSplit() {
  if (!selectedMedia.value) {
    return
  }

  const segmentValue = Number(segmentSeconds.value)
  if (!Number.isInteger(segmentValue) || segmentValue <= 0) {
    ElMessage.error('请输入正整数秒数')
    return
  }

  segmentSeconds.value = segmentValue
  await splitStore.runSplit(selectedMedia.value.file, segmentValue)
  if (splitStore.status === 'success') {
    await mediaStore.touch(selectedMedia.value.id)
    const successText =
      splitStore.downloadUsedMode === 'directory'
        ? `分段完成，文件已写入目录：${splitStore.downloadDirectoryName ?? '已选择目录'}`
        : '分段完成，已开始下载'
    ElMessage.success(successText)
    dialogVisible.value = false
  } else if (splitStore.errorMessage) {
    ElMessage.error(splitStore.errorMessage)
  }
}

async function remove(id: string) {
  await mediaStore.remove(id)
  ElMessage.success('素材已删除')
}

function formatDuration(seconds: number): string {
  const value = Math.floor(seconds)
  const m = String(Math.floor(value / 60)).padStart(2, '0')
  const s = String(value % 60).padStart(2, '0')
  return `${m}:${s}`
}

const expectedCount = computed(() => {
  if (!selectedMedia.value || segmentSeconds.value <= 0) {
    return 0
  }

  return Math.ceil(selectedMedia.value.durationSeconds / segmentSeconds.value)
})
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <label class="upload-button">
        导入 MP4
        <input type="file" accept="video/mp4" multiple @change="onFileInput" />
      </label>
      <el-segmented
        :model-value="splitStore.mode"
        :options="[
          { label: '快速关键帧', value: 'fast_keyframe' },
          { label: '全精确切割', value: 'precise' }
        ]"
        @change="(value) => splitStore.setMode(value as SplitMode)"
      />
    </div>

    <el-alert
      title="快速关键帧模式会对齐切点，时长可能有轻微偏差；精确模式更慢但更准"
      type="info"
      :closable="false"
      show-icon
      class="tips"
    />

    <el-table :data="mediaStore.items" v-loading="mediaStore.loading" empty-text="请先导入素材">
      <el-table-column prop="name" label="文件名" min-width="220" />
      <el-table-column label="时长" width="120">
        <template #default="scope">{{ formatDuration(scope.row.durationSeconds) }}</template>
      </el-table-column>
      <el-table-column label="分辨率" width="130">
        <template #default="scope">{{ scope.row.width }}x{{ scope.row.height }}</template>
      </el-table-column>
      <el-table-column label="大小(MB)" width="120">
        <template #default="scope">{{ (scope.row.size / 1024 / 1024).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="230">
        <template #default="scope">
          <el-button type="primary" link @click="openSplitDialog(scope.row.id)">自动分段</el-button>
          <el-button type="danger" link @click="remove(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" title="自动按时长分段" width="560px">
    <div v-if="selectedMedia" class="split-dialog">
      <p><strong>素材：</strong>{{ selectedMedia.name }}</p>
      <p><strong>总时长：</strong>{{ formatDuration(selectedMedia.durationSeconds) }}</p>
      <el-form label-width="120px">
        <el-form-item label="分段秒数">
          <el-input-number v-model="segmentSeconds" :min="1" :step="1" />
        </el-form-item>
        <el-form-item label="预计段数">
          <el-tag type="success">{{ expectedCount }} 段</el-tag>
        </el-form-item>
        <el-form-item label="输出目录">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            <el-tag v-if="splitStore.downloadMode === 'directory'" type="success">
              {{ splitStore.downloadDirectoryName ?? '已设置目录' }}
            </el-tag>
            <el-tag v-else type="info">浏览器默认下载目录</el-tag>
            <el-button
              v-if="splitStore.directoryOutputSupported"
              size="small"
              @click="chooseDirectory"
            >
              选择目录
            </el-button>
            <el-button
              v-if="splitStore.downloadMode === 'directory'"
              size="small"
              @click="useBrowserDownloadMode"
            >
              恢复浏览器下载
            </el-button>
            <span v-if="!splitStore.directoryOutputSupported" style="color: #909399; font-size: 12px">
              当前浏览器不支持目录写入，将使用浏览器下载
            </span>
          </div>
        </el-form-item>
      </el-form>

      <div v-if="splitStore.status === 'running'" class="progress">
        <el-progress :percentage="Math.round(splitStore.progress * 100)" />
        <p>{{ splitStore.stageText }} 第 {{ splitStore.currentPiece }} / {{ splitStore.totalPieces }} 段</p>
      </div>

      <div v-if="splitStore.latestResult" class="latest-result">
        <p>上次耗时：{{ (splitStore.latestResult.elapsedMs / 1000).toFixed(1) }} 秒</p>
        <p>最大偏差：{{ splitStore.latestResult.maxDeviationMs.toFixed(0) }} ms</p>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="splitStore.status === 'running'" @click="runSplit">
        开始分段
      </el-button>
    </template>
  </el-dialog>
</template>

