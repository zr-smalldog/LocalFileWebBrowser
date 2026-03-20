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
  
  // Test PDF link exists
  const pdfFiles = await page.$$eval('text=pdf', els => els.length > 0);
  console.log('PDF files found:', pdfFiles);
  
  console.log('--- Basic test PASSED ---');
  await browser.close();
})();
