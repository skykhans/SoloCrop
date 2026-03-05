import { expect, test } from '@playwright/test'
import { goEditor, importSample } from './utils'

test('E2E-USABILITY-PATH-001 核心路径可用性冒烟', async ({ page }) => {
  await importSample(page)
  await goEditor(page)

  await expect(page.getByRole('button', { name: '加入时间轴' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '时间轴' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '字幕' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '导出' })).toBeVisible()
})
