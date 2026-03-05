import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const coreSourceDir = resolve(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')
const workerSourceDir = resolve(root, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm')
const targetDir = resolve(root, 'public', 'ffmpeg')
const workerTargetDir = resolve(targetDir, 'worker')

if (!existsSync(coreSourceDir)) {
  console.warn('[sync-ffmpeg-core] core source not found:', coreSourceDir)
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
copyFileSync(resolve(coreSourceDir, 'ffmpeg-core.js'), resolve(targetDir, 'ffmpeg-core.js'))
copyFileSync(resolve(coreSourceDir, 'ffmpeg-core.wasm'), resolve(targetDir, 'ffmpeg-core.wasm'))

if (existsSync(workerSourceDir)) {
  mkdirSync(workerTargetDir, { recursive: true })
  copyFileSync(resolve(workerSourceDir, 'worker.js'), resolve(workerTargetDir, 'worker.js'))
  copyFileSync(resolve(workerSourceDir, 'const.js'), resolve(workerTargetDir, 'const.js'))
  copyFileSync(resolve(workerSourceDir, 'errors.js'), resolve(workerTargetDir, 'errors.js'))

  // Force local core path to avoid any CDN fallback.
  const constPath = resolve(workerTargetDir, 'const.js')
  const constText = readFileSync(constPath, 'utf8')
  const patched = constText.replace(
    /^export const CORE_URL\s*=.*;$/m,
    "export const CORE_URL = '/ffmpeg/ffmpeg-core.js';"
  )
  writeFileSync(constPath, patched, 'utf8')
}

console.log('[sync-ffmpeg-core] copied local ffmpeg runtime files to public/ffmpeg')
