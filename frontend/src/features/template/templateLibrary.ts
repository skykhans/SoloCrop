import type { TemplatePreset } from '../../types/editor'

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'vlog-fast',
    name: 'Vlog 快剪',
    description: '高饱和+轻淡入淡出，搭配开场互动贴纸。',
    visualAdjust: {
      brightness: 0.06,
      contrast: 1.08,
      saturation: 1.2
    },
    transition: {
      fadeInMs: 250,
      fadeOutMs: 250
    },
    stickers: [
      {
        text: 'LIKE',
        startOffsetMs: 300,
        durationMs: 1300,
        adjust: { xPct: 0.14, yPct: 0.16, scale: 1.1, opacity: 0.96 },
        style: { variant: 'pill', bgColor: '#ff3b30', textColor: '#ffffff', borderColor: '#ffd6d1' }
      },
      {
        text: 'WOW',
        startOffsetMs: 1900,
        durationMs: 1300,
        adjust: { xPct: 0.82, yPct: 0.2, scale: 1.04, opacity: 0.92 },
        style: { variant: 'burst', bgColor: '#ffb300', textColor: '#1c1c1c', borderColor: '#fff2c2' }
      }
    ],
    subtitles: [
      { text: '今天带你 30 秒看完重点', startOffsetMs: 300, durationMs: 1600 }
    ]
  },
  {
    id: 'story-clean',
    name: '故事讲述',
    description: '轻对比+更长转场，适合口播和讲解节奏。',
    visualAdjust: {
      brightness: 0.02,
      contrast: 1.04,
      saturation: 1.02
    },
    transition: {
      fadeInMs: 500,
      fadeOutMs: 500
    },
    stickers: [
      {
        text: 'NEW',
        startOffsetMs: 600,
        durationMs: 1800,
        adjust: { xPct: 0.18, yPct: 0.84, scale: 0.95, opacity: 0.86 },
        style: { variant: 'badge', bgColor: '#20b26b', textColor: '#ffffff', borderColor: '#dbffe9' }
      }
    ],
    subtitles: [
      { text: '核心信息先说结论', startOffsetMs: 500, durationMs: 1800 },
      { text: '再补充关键细节', startOffsetMs: 2600, durationMs: 1600 }
    ]
  },
  {
    id: 'sale-promo',
    name: '促销冲刺',
    description: '高对比+高饱和，附带促销贴纸与口号字幕。',
    visualAdjust: {
      brightness: 0.1,
      contrast: 1.18,
      saturation: 1.28
    },
    transition: {
      fadeInMs: 180,
      fadeOutMs: 180
    },
    stickers: [
      {
        text: 'SALE',
        startOffsetMs: 200,
        durationMs: 1500,
        adjust: { xPct: 0.85, yPct: 0.14, scale: 1.2, opacity: 1 },
        style: { variant: 'pill', bgColor: '#2f6dff', textColor: '#ffffff', borderColor: '#d8e4ff' }
      },
      {
        text: 'HOT',
        startOffsetMs: 1900,
        durationMs: 1200,
        adjust: { xPct: 0.16, yPct: 0.78, scale: 1.08, opacity: 0.94 },
        style: { variant: 'burst', bgColor: '#ffb300', textColor: '#1c1c1c', borderColor: '#fff2c2' }
      }
    ],
    subtitles: [
      { text: '限时优惠进行中', startOffsetMs: 300, durationMs: 1200 },
      { text: '现在下单立减', startOffsetMs: 1900, durationMs: 1300 }
    ]
  }
]

export function resolveTemplatePreset(templateId: string): TemplatePreset | null {
  return TEMPLATE_PRESETS.find((item) => item.id === templateId) ?? null
}
