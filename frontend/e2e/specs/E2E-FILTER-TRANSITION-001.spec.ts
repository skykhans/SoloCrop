import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-FILTER-TRANSITION-001 滤镜与转场可配置', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  const videoRow = page.locator('.timeline-track-row').filter({ hasText: '视频轨' })
  await videoRow.locator('.timeline-item').first().click()
  await page.getByRole('tab', { name: '滤镜与转场（首版）' }).click()
  await expect(page.getByText('滤镜与转场（首版）')).toBeVisible()

  await page.locator('.el-form-item').filter({ hasText: '亮度' }).locator('.el-slider').click()
  await page.locator('.el-form-item').filter({ hasText: '对比度' }).locator('.el-slider').click()

  await page.locator('.el-form-item').filter({ hasText: '淡入(s)' }).locator('.el-input-number__increase').click()
  await page.locator('.el-form-item').filter({ hasText: '淡出(s)' }).locator('.el-input-number__increase').click()

  await page.getByRole('button', { name: '保存工程' }).click()
  await expect(page.getByText('工程已保存')).toBeVisible()
})
