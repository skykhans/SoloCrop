import type { TransitionAdjust, VisualAdjust } from '../../types/editor'

export interface FilterPreset {
  id: string
  name: string
  visualAdjust: Partial<VisualAdjust>
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'clear',
    name: '清透',
    visualAdjust: { brightness: 0.04, contrast: 1.08, saturation: 1.05 }
  },
  {
    id: 'film',
    name: '胶片',
    visualAdjust: { brightness: -0.03, contrast: 1.14, saturation: 0.9 }
  },
  {
    id: 'vivid',
    name: '鲜艳',
    visualAdjust: { brightness: 0.08, contrast: 1.16, saturation: 1.28 }
  },
  {
    id: 'cool',
    name: '冷调',
    visualAdjust: { brightness: -0.01, contrast: 1.06, saturation: 0.86 }
  }
]

export function normalizeTransitionAdjust(value?: Partial<TransitionAdjust>): TransitionAdjust {
  return {
    fadeInMs: Math.max(0, Math.floor(value?.fadeInMs ?? 0)),
    fadeOutMs: Math.max(0, Math.floor(value?.fadeOutMs ?? 0))
  }
}
