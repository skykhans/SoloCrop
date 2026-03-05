import { expect, test } from '@playwright/test'
import { importSample } from './utils'

test('E2E-MEDIA-IMPORT-001 导入MP4素材并显示在素材库', async ({ page }) => {
  await importSample(page)
  await expect(page.locator('.el-table__body')).toContainText('.mp4')
})
