import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-SUBTITLE-AUTO-001 自动字幕生成并可编辑', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  await page.getByRole('tab', { name: '字幕' }).click()
  await page.getByRole('button', { name: '自动字幕（本地ASR）' }).click()
  const subtitlePanel = page.getByRole('tabpanel', { name: '字幕' })
  await expect(subtitlePanel.locator('input[value^=\"自动字幕片段\"]').first()).toBeVisible({ timeout: 120000 })
})
