const puppeteer = require('puppeteer');
const fs = require('fs');
const { createInterface } = require('readline');

const SESSION_FILE = './session.json';
(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Must be false so you can manually solve CAPTCHA or 2FA
  });
  const page = await browser.newPage();

  await new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Press Enter to exit...', () => {
      rl.close();
      resolve();
    });
  });

  // Save session (cookies)
  const cookies = await browser.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log('Session saved to file.');

  await browser.close();
})();