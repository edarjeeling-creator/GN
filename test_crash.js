const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER_CONSOLE_ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('BROWSER_PAGE_ERROR:', error.message);
  });

  console.log("Navigating to http://localhost:5173/principal ...");
  try {
    await page.goto('http://localhost:5173/principal', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully. Checking body...');
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body text preview:", bodyText.substring(0, 100));
  } catch (e) {
    console.log('Navigation error:', e.message);
  }

  await browser.close();
})();
