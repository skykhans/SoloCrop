import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-TEMPLATE-001 模板系统一键应用', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  await expect(page.getByText('模板系统（首版）')).toBeVisible()
  await page.getByRole('button', { name: '应用模板' }).click()
  await expect(page.getByText('已应用模板')).toBeVisible()

  const stickerRow = page.locator('.timeline-track-row').filter({ hasText: '贴纸轨' })
  await expect(stickerRow.locator('.timeline-item')).toHaveCount(2)
})
