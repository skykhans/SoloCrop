<script setup lang="ts">
import { ref } from 'vue'

const memoryHint = ref(500)
</script>

<template>
  <div class="panel">
    <h2>设置</h2>
    <el-form label-width="180px" style="max-width: 640px">
      <el-form-item label="大文件提示阈值 (MB)">
        <el-input-number v-model="memoryHint" :min="100" :max="4096" :step="50" />
      </el-form-item>
    </el-form>
    <el-alert
      title="建议在 Chrome/Edge 最新版使用；大文件切割依赖浏览器内存，建议分段处理。"
      :closable="false"
      type="warning"
      show-icon
    />
  </div>
</template>
