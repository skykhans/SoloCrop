type DownloadMode = 'browser' | 'directory'

interface DownloadPreference {
  mode: DownloadMode
  directoryName: string | null
}

const STORAGE_KEY = 'solocrop.download.preference'
let directoryHandle: FileSystemDirectoryHandle | null = null
type PermissionStateValue = 'granted' | 'denied' | 'prompt'

interface PermissionDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionStateValue>
  requestPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionStateValue>
}

export function isDirectoryOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function getDownloadPreference(): DownloadPreference {
  if (typeof window === 'undefined') {
    return { mode: 'browser', directoryName: null }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { mode: 'browser', directoryName: null }
  }

  try {
    const value = JSON.parse(raw) as DownloadPreference
    if (value.mode === 'directory' || value.mode === 'browser') {
      return value
    }
  } catch {
    // Ignore corrupted storage.
  }

  return { mode: 'browser', directoryName: null }
}

export function useBrowserDownload(): void {
  directoryHandle = null
  savePreference({ mode: 'browser', directoryName: null })
}

export async function chooseDownloadDirectory(): Promise<string> {
  if (!isDirectoryOutputSupported()) {
    throw new Error('当前浏览器不支持目录写入，请使用最新版 Chrome/Edge')
  }

  const handle = await (window as Window & typeof globalThis & {
    showDirectoryPicker: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker({ mode: 'readwrite' })

  const permission = await (handle as PermissionDirectoryHandle).requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') {
    throw new Error('目录写入权限未授予')
  }

  directoryHandle = handle
  savePreference({ mode: 'directory', directoryName: handle.name })
  return handle.name
}

export async function ensureDirectoryPermission(): Promise<boolean> {
  if (!directoryHandle) {
    return false
  }

  const state = await (directoryHandle as PermissionDirectoryHandle).queryPermission({ mode: 'readwrite' })
  if (state === 'granted') {
    return true
  }

  return (await (directoryHandle as PermissionDirectoryHandle).requestPermission({ mode: 'readwrite' })) === 'granted'
}

export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    await wait(120)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadBatch(outputs: { fileName: string; blob: Blob }[]): Promise<DownloadMode> {
  const preference = getDownloadPreference()
  if (preference.mode === 'directory' && (await ensureDirectoryPermission())) {
    for (const item of outputs) {
      await writeToDirectory(item.blob, item.fileName)
    }
    return 'directory'
  }

  for (const item of outputs) {
    await downloadBlob(item.blob, item.fileName)
  }
  return 'browser'
}

async function writeToDirectory(blob: Blob, fileName: string): Promise<void> {
  if (!directoryHandle) {
    throw new Error('目录句柄不存在')
  }

  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

function savePreference(value: DownloadPreference): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
