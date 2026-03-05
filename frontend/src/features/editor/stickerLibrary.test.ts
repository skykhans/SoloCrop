import { describe, expect, it } from 'vitest'
import { createDefaultStickerStyle, normalizeStickerStyle, normalizeStickerVariant, STICKER_LIBRARY } from './stickerLibrary'

describe('stickerLibrary', () => {
  it('provides built-in graphical sticker items', () => {
    expect(STICKER_LIBRARY.length).toBeGreaterThanOrEqual(4)
    expect(STICKER_LIBRARY.map((item) => item.text)).toContain('LIKE')
  })

  it('normalizes unknown variant to text', () => {
    expect(normalizeStickerVariant('unknown')).toBe('text')
    expect(normalizeStickerVariant('pill')).toBe('pill')
  })

  it('merges partial style into defaults', () => {
    const style = normalizeStickerStyle({ variant: 'badge', bgColor: '#123456' })
    expect(style.variant).toBe('badge')
    expect(style.bgColor).toBe('#123456')
    expect(style.textColor).toBe(createDefaultStickerStyle().textColor)
  })
})
