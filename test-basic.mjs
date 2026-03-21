import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Opening page...');
  await page.goto('http://127.0.0.1:3210');
  
  console.log('Waiting for page load...');
  await page.waitForLoadState('networkidle');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check sidebar exists
  const sidebar = await page.$('.sidebar');
  console.log('Sidebar found:', !!sidebar);
  
  // Check entry list
  const entries = await page.$$('.entry');
  console.log('Entry count:', entries.length);
  
  // Check search input
  const searchInput = await page.$('#fileSearchInput');
  console.log('Search input found:', !!searchInput);
  
  // Enter project directory and verify metadata panel on README
  const projectDir = page.locator('.entry', { hasText: 'LocalFileWebBrowser' }).first();
  if (await projectDir.count()) {
    await projectDir.click();
    await page.waitForLoadState('networkidle');
    const readme = page.locator('.entry', { hasText: 'README.md' }).first();
    await readme.click();
    await page.waitForTimeout(800);
    const metaText = await page.locator('#fileMeta').textContent();
    console.log('Meta panel includes MIME:', /MIME/.test(metaText || ''));
    console.log('Meta panel includes README:', /README\.md/.test(metaText || ''));
  }
  
  console.log('--- Basic test PASSED ---');
  await browser.close();
})();
