import Dexie, { type Table } from 'dexie'
import type { MediaAsset } from '../types/media'

export interface ProjectDraft {
  id: string
  name: string
  content: string
  updatedAt: string
}

class SoloCropDB extends Dexie {
  mediaAssets!: Table<MediaAsset, string>
  projectDrafts!: Table<ProjectDraft, string>

  constructor() {
    super('solocrop')
    this.version(1).stores({
      mediaAssets: 'id, name, createdAt, lastUsedAt',
      projectDrafts: 'id, updatedAt'
    })
  }
}

export const db = new SoloCropDB()
