import type { TemplatePreset } from '../../types/editor'

const CUSTOM_TEMPLATE_STORAGE_KEY = 'solocrop.template.custom.presets'

function normalizeTemplatePreset(template: TemplatePreset): TemplatePreset {
  return {
    id: String(template.id || `custom-${crypto.randomUUID()}`),
    name: String(template.name || 'Untitled Template').trim().slice(0, 24) || 'Untitled Template',
    description: String(template.description || 'Custom template').trim().slice(0, 80) || 'Custom template',
    source: 'custom',
    visualAdjust: { ...(template.visualAdjust ?? {}) },
    transition: { ...(template.transition ?? {}) },
    stickers: Array.isArray(template.stickers) ? template.stickers.map((item) => ({ ...item })) : [],
    subtitles: Array.isArray(template.subtitles) ? template.subtitles.map((item) => ({ ...item })) : []
  }
}

export function loadCustomTemplates(storage: Storage = window.localStorage): TemplatePreset[] {
  const raw = storage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as TemplatePreset[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((item) => normalizeTemplatePreset(item))
  } catch {
    return []
  }
}

export function saveCustomTemplate(template: TemplatePreset, storage: Storage = window.localStorage): TemplatePreset[] {
  const next = normalizeTemplatePreset(template)
  const templates = loadCustomTemplates(storage).filter((item) => item.id !== next.id)
  templates.unshift(next)
  storage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(templates))
  return templates
}

export function deleteCustomTemplate(templateId: string, storage: Storage = window.localStorage): TemplatePreset[] {
  const templates = loadCustomTemplates(storage).filter((item) => item.id !== templateId)
  storage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(templates))
  return templates
}