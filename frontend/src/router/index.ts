import { createRouter, createWebHistory } from 'vue-router'
import MediaView from '../views/MediaView.vue'

const routes = [
  { path: '/', redirect: '/media' },
  { path: '/media', component: MediaView },
  {
    path: '/editor/:projectId',
    component: () => import('../views/EditorView.vue')
  },
  {
    path: '/settings',
    component: () => import('../views/SettingsView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
