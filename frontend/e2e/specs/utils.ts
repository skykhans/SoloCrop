import path from 'node:path'
import { expect, type Page } from '@playwright/test'

export function sampleVideoPath(): string {
  return path.resolve(process.cwd(), '..', 'sample.mp4')
}

export async function importSample(page: Page): Promise<void> {
  await page.goto('/media')
  const input = page.locator('input[type="file"][accept="video/mp4"]')
  await input.setInputFiles(sampleVideoPath())
  await expect(page.getByText('素材已导入')).toBeVisible()
  await expect(page.locator('.el-table__body')).toContainText('.mp4')
}

export async function goEditor(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: '编辑器' }).click()
  await expect(page).toHaveURL(/\/editor\/default/)
  const addBtn = page.getByRole('button', { name: '加入时间轴' })
  await expect(addBtn).toBeVisible()
  await expect(addBtn).toBeEnabled()
}

export async function addFirstMediaToTimeline(page: Page): Promise<void> {
  await page.getByRole('button', { name: '加入时间轴' }).click()
  const targetCount = 2
  const itemLocator = page.locator('.timeline-item')
  try {
    await expect(itemLocator).toHaveCount(targetCount, { timeout: 6000 })
  } catch {
    const count = await itemLocator.count()
    throw new Error(`timeline item count mismatch: expected=${targetCount}, actual=${count}, url=${page.url()}`)
  }
}
