import { beforeEach, describe, expect, it } from 'vitest'
import type { TemplatePreset } from '../../types/editor'
import { deleteCustomTemplate, loadCustomTemplates, saveCustomTemplate } from './customTemplateStorage'

const storage = window.localStorage

const sampleTemplate: TemplatePreset = {
  id: 'custom-1',
  name: 'My Template',
  description: 'Verifies local custom template persistence',
  source: 'custom',
  visualAdjust: { brightness: 0.1, contrast: 1.2, saturation: 1.1 },
  transition: { fadeInMs: 200, fadeOutMs: 300 },
  stickers: [{ text: 'WOW', startOffsetMs: 200, durationMs: 1000 }],
  subtitles: [{ text: 'Caption', startOffsetMs: 300, durationMs: 1200 }]
}

describe('custom template storage', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('saves and reloads custom templates', () => {
    saveCustomTemplate(sampleTemplate, storage)

    const templates = loadCustomTemplates(storage)
    expect(templates).toHaveLength(1)
    expect(templates[0].name).toBe('My Template')
    expect(templates[0].source).toBe('custom')
  })

  it('replaces duplicated template ids and keeps latest first', () => {
    saveCustomTemplate(sampleTemplate, storage)
    saveCustomTemplate({ ...sampleTemplate, description: 'Latest version' }, storage)

    const templates = loadCustomTemplates(storage)
    expect(templates).toHaveLength(1)
    expect(templates[0].description).toBe('Latest version')
  })

  it('deletes custom templates by id', () => {
    saveCustomTemplate(sampleTemplate, storage)

    const templates = deleteCustomTemplate(sampleTemplate.id, storage)
    expect(templates).toHaveLength(0)
    expect(loadCustomTemplates(storage)).toEqual([])
  })
})