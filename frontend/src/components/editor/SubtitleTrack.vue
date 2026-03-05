<script setup lang="ts">
import { computed } from 'vue'
import type { SubtitleSegment } from '../../types/editor'

const props = defineProps<{
  segments: SubtitleSegment[]
}>()

const emit = defineEmits<{
  updateText: [id: string, text: string]
  updateRange: [id: string, startMs: number, endMs: number]
  toggle: [id: string, enabled: boolean]
}>()

const rows = computed(() => props.segments.slice().sort((a, b) => a.startMs - b.startMs))

function toSec(ms: number): number {
  return Number((ms / 1000).toFixed(2))
}
</script>

<template>
  <div class="subtitle-track-editor">
    <el-table data-testid="subtitle-table" :data="rows" size="small" empty-text="暂无字幕">
      <el-table-column label="启用" width="72">
        <template #default="scope">
          <el-switch
            :model-value="scope.row.enabled"
            @change="(value) => emit('toggle', scope.row.id, Boolean(value))"
          />
        </template>
      </el-table-column>
      <el-table-column label="开始(s)" width="110">
        <template #default="scope">
          <el-input-number
            :model-value="toSec(scope.row.startMs)"
            :min="0"
            :step="0.1"
            @change="(value) => emit('updateRange', scope.row.id, Math.floor(Number(value || 0) * 1000), scope.row.endMs)"
          />
        </template>
      </el-table-column>
      <el-table-column label="结束(s)" width="110">
        <template #default="scope">
          <el-input-number
            :model-value="toSec(scope.row.endMs)"
            :min="toSec(scope.row.startMs) + 0.1"
            :step="0.1"
            @change="(value) => emit('updateRange', scope.row.id, scope.row.startMs, Math.floor(Number(value || 0) * 1000))"
          />
        </template>
      </el-table-column>
      <el-table-column label="文本" min-width="260">
        <template #default="scope">
          <el-input
            :model-value="scope.row.text"
            @input="(value) => emit('updateText', scope.row.id, String(value))"
          />
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="scope">{{ scope.row.confidence.toFixed(2) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>
