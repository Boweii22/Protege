import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(()=>localStorage.setItem('protege.onboarded.e2e@protege.test','true'));
const errors = [];
page.on('console', message => {
  if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(`console: ${message.text()}`);
});
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

await page.goto(process.env.PROTEGE_URL ?? 'http://127.0.0.1:5175', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /meet Maya/i }).click();
if (process.env.PROTEGE_TOPIC) {
  await page.getByRole('button', { name: new RegExp(process.env.PROTEGE_TOPIC, 'i') }).click();
}
await page.getByRole('button', { name: /begin the lesson/i }).click();
await page.waitForTimeout(500);
const lessonVisible = await page.getByText('Make it click.').isVisible().catch(() => false);
await page.getByLabel('Your explanation').fill('A plant builds glucose by fixing carbon from carbon dioxide in the air.');
await page.getByRole('button', { name: /send explanation/i }).click();
const replyVisible = await page.locator('.messages article.student').count() >= 2;
await page.getByRole('button', { name: /test her/i }).click();
await page.waitForTimeout(500);
const examVisible = await page.getByText('The lesson is sealed.').isVisible().catch(() => false);
const resultsVisible = await page.getByText('Maya scored').waitFor({state:'visible',timeout:60000}).then(()=>true).catch(()=>false);
const bodyText = await page.locator('body').innerText();
console.log(JSON.stringify({ lessonVisible, replyVisible, examVisible, resultsVisible, bodyLength: bodyText.length, bodyPreview: bodyText.slice(0, 240), errors }, null, 2));
await page.screenshot({ path: 'lesson-smoke.png', fullPage: true });
await browser.close();
if (!lessonVisible || !replyVisible || !examVisible || !resultsVisible || errors.length) process.exit(1);
