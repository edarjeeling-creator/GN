const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.log(`[PAGE ERROR] ${error.message}`));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000); // Wait for potential errors

  await browser.close();
})();
