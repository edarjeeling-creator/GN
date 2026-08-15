import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push('PageError: ' + err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('ConsoleError: ' + msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    errors.push('GotoError: ' + e.message);
  }

  console.log("ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})();
