import { expect, test } from '@playwright/test'

test('E2E-EXPORT-RETRY-001 失败任务可手动重试', async ({ page }) => {
  await page.addInitScript(() => {
    const payload = [
      {
        id: 'failed-task-1',
        clips: [],
        pipelineVersion: 3,
        mode: 'final',
        preset: 'source',
        bitrate: 'auto',
        retryCount: 0,
        maxRetries: 2,
        autoRetry: true,
        retryable: true,
        status: 'failed',
        progress: 0,
        current: 0,
        total: 2,
        message: '模拟失败',
        createdAt: new Date().toISOString()
      }
    ]
    window.localStorage.setItem('solocrop.editor.export.queue', JSON.stringify(payload))
  })

  await page.goto('/editor/default')
  await page.getByRole('tab', { name: '导出' }).click()
  const queueTable = page.getByRole('table').last()
  await expect(queueTable).toContainText('失败')
  await page.getByRole('button', { name: '重试失败任务' }).click()
  await expect(queueTable).toContainText(/排队中|执行中/, { timeout: 10000 })
})
