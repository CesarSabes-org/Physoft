import { test, expect } from '@playwright/test'

test('optional focus, general follow-up and responsive conversation layout', async ({ page }, testInfo) => {
  // Synthetic UI identity, only in the isolated browser context. API is mocked;
  // real JWT verification is exercised separately by backend HTTP tests.
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ id: 'ui-test', email: 'test@example.invalid', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 }))
    localStorage.setItem('physoft_auth_token', `synthetic.${payload}.not-a-real-signature`)
  })
  const requests: { message: string; mode: string; history: unknown[] }[] = []
  await page.route('**/api/chat/messages', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } })
      return
    }
    const body = route.request().postDataJSON()
    requests.push(body)
    await route.fulfill({ json: { success: true, data: { mode: body.mode, truncated: false,
      content: '## Strength and power\n\n**Strength** is the ability to produce force. Power describes how quickly work is performed.\n\n- Use consistent tests to track progress.\n- Interpret results in their measurement context.' } }, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.goto('/assistant')
  await expect(page.getByRole('heading', { name: 'What would you like to understand?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: /Explain concepts/ }).click()
  await expect(page.getByRole('button', { name: /Explain concepts/ })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: testInfo.outputPath('assistant-initial.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'Your question' }).fill('What is the difference between strength and power?')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Strength and power' })).toBeVisible()
  expect(requests[0]).toEqual({ message: 'What is the difference between strength and power?', mode: 'explain_concepts', history: [] })
  await page.getByRole('button', { name: /Explain concepts/ }).click()
  await page.getByRole('textbox').fill('How should I track progress?')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Strength and power' })).toHaveCount(2)
  expect(requests[1].mode).toBe('general')
  expect(requests[1].history).toHaveLength(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('assistant-conversation.png'), fullPage: true })
  await page.getByRole('button', { name: 'New conversation' }).click()
  await expect(page.getByRole('log')).toHaveCount(0)
})
