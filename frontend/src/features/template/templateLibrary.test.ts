import { describe, expect, it } from 'vitest'
import { resolveTemplatePreset, TEMPLATE_PRESETS } from './templateLibrary'

describe('template library', () => {
  it('provides at least one preset', () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThan(0)
  })

  it('resolves preset by id', () => {
    const first = TEMPLATE_PRESETS[0]
    const matched = resolveTemplatePreset(first.id)
    expect(matched?.name).toBe(first.name)
  })
})
