import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-TIMELINE-EDIT-001 时间轴编辑并保存草稿', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  await expect(page.locator('.timeline-item')).toHaveCount(2)
  await page.getByRole('button', { name: '保存工程' }).click()
  await expect(page.getByText('工程已保存')).toBeVisible()
})
