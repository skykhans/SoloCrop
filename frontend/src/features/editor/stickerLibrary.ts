import type { StickerStyle, StickerVariant } from '../../types/editor'

export interface StickerLibraryItem {
  id: string
  name: string
  text: string
  style: StickerStyle
}

export function createDefaultStickerStyle(): StickerStyle {
  return {
    variant: 'text',
    bgColor: '#ff4d4f',
    textColor: '#ffffff',
    borderColor: '#ffffff'
  }
}

export function normalizeStickerStyle(style?: Partial<StickerStyle>): StickerStyle {
  return {
    ...createDefaultStickerStyle(),
    ...(style ?? {}),
    variant: normalizeStickerVariant(style?.variant)
  }
}

export function normalizeStickerVariant(value: string | undefined): StickerVariant {
  if (value === 'pill' || value === 'badge' || value === 'burst') {
    return value
  }
  return 'text'
}

export const STICKER_LIBRARY: StickerLibraryItem[] = [
  {
    id: 'like-pill',
    name: '点赞条',
    text: 'LIKE',
    style: {
      variant: 'pill',
      bgColor: '#ff3b30',
      textColor: '#ffffff',
      borderColor: '#ffd6d1'
    }
  },
  {
    id: 'wow-burst',
    name: '高光爆点',
    text: 'WOW',
    style: {
      variant: 'burst',
      bgColor: '#ffb300',
      textColor: '#1c1c1c',
      borderColor: '#fff3c0'
    }
  },
  {
    id: 'new-badge',
    name: '新品角标',
    text: 'NEW',
    style: {
      variant: 'badge',
      bgColor: '#20b26b',
      textColor: '#ffffff',
      borderColor: '#dbffe9'
    }
  },
  {
    id: 'sale-pill',
    name: '促销条',
    text: 'SALE',
    style: {
      variant: 'pill',
      bgColor: '#2f6dff',
      textColor: '#ffffff',
      borderColor: '#d8e4ff'
    }
  }
]
