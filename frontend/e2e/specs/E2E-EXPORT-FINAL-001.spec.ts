import { expect, test } from '@playwright/test'
import { addFirstMediaToTimeline, goEditor, importSample } from './utils'

test('E2E-EXPORT-FINAL-001 导出成片并出现成功状态', async ({ page }) => {
  await importSample(page)
  await goEditor(page)
  await addFirstMediaToTimeline(page)

  await page.getByRole('tab', { name: '导出' }).click()
  await page.getByRole('button', { name: '导出成片（默认）' }).click()
  const queueTable = page.getByRole('table').last()
  await expect(queueTable).toContainText(/排队中|执行中/)
  await expect(queueTable).toContainText('成功', { timeout: 180000 })
})
