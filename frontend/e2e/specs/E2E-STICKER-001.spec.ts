import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-STICKER-001 贴纸添加与编辑', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  await page.getByRole('tab', { name: '贴纸素材库（首版）' }).click()
  await page.getByRole('button', { name: 'LIKE' }).click()
  const stickerRow = page.locator('.timeline-track-row').filter({ hasText: '贴纸轨' })
  await expect(stickerRow.locator('.timeline-item')).toHaveCount(1)

  await stickerRow.locator('.timeline-item').first().click()
  const stickerInput = page.locator('.el-form-item').filter({ hasText: '贴纸文本' }).locator('input')
  await stickerInput.fill('HOT')
  await stickerInput.press('Enter')

  await page.getByRole('button', { name: '保存工程' }).click()
  await expect(page.getByText('工程已保存')).toBeVisible()
})
