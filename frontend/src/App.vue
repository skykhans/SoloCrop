<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path.startsWith('/editor') ? '/editor' : route.path)

const menuItems = [
  { key: '/media', label: '素材库' },
  { key: '/editor/default', label: '编辑器' },
  { key: '/settings', label: '设置' }
]

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="210px" class="sidebar">
      <div class="brand">SoloCrop</div>
      <el-menu :default-active="activeMenu" class="menu" @select="go">
        <el-menu-item v-for="item in menuItems" :key="item.key" :index="item.key">
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div class="title">纯前端视频切割工具</div>
      </el-header>
      <el-main class="content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
