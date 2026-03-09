import type { TemplatePreset } from '../../types/editor'

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'vlog-fast',
    source: 'builtin',
    name: 'Vlog \u5feb\u526a',
    description: '\u9ad8\u9971\u548c+\u8f7b\u6de1\u5165\u6de1\u51fa\uff0c\u642d\u914d\u5f00\u573a\u4e92\u52a8\u8d34\u7eb8\u3002',
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
      { text: '\u4eca\u5929\u5e26\u4f60 30 \u79d2\u770b\u5b8c\u91cd\u70b9', startOffsetMs: 300, durationMs: 1600 }
    ]
  },
  {
    id: 'story-clean',
    source: 'builtin',
    name: '\u6545\u4e8b\u8bb2\u8ff0',
    description: '\u8f7b\u5bf9\u6bd4+\u66f4\u957f\u8f6c\u573a\uff0c\u9002\u5408\u53e3\u64ad\u548c\u8bb2\u89e3\u8282\u594f\u3002',
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
      { text: '\u6838\u5fc3\u4fe1\u606f\u5148\u8bf4\u7ed3\u8bba', startOffsetMs: 500, durationMs: 1800 },
      { text: '\u518d\u8865\u5145\u5173\u952e\u7ec6\u8282', startOffsetMs: 2600, durationMs: 1600 }
    ]
  },
  {
    id: 'sale-promo',
    source: 'builtin',
    name: '\u4fc3\u9500\u51b2\u523a',
    description: '\u9ad8\u5bf9\u6bd4+\u9ad8\u9971\u548c\uff0c\u9644\u5e26\u4fc3\u9500\u8d34\u7eb8\u4e0e\u53e3\u53f7\u5b57\u5e55\u3002',
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
      { text: '\u9650\u65f6\u4f18\u60e0\u8fdb\u884c\u4e2d', startOffsetMs: 300, durationMs: 1200 },
      { text: '\u73b0\u5728\u4e0b\u5355\u7acb\u51cf', startOffsetMs: 1900, durationMs: 1300 }
    ]
  }
]

export function resolveTemplatePreset(templateId: string): TemplatePreset | null {
  return TEMPLATE_PRESETS.find((item) => item.id === templateId) ?? null
}