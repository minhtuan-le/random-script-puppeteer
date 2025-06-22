const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
// Or import puppeteer from 'puppeteer-core';

const SESSION_FILE = './session.json';
const DOMAIN = 'https://au.jora.com';

const avoidList=["cook", "chef", "manager", "kitchen hand", "massage", "head", "driver", "factory", "worker", "nail", "beauty"];

//Disable loading of images, fonts, CSS
async function blockAssets(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const blockedTypes = ['image', 'font'];
    if (blockedTypes.includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });
}

// Launch the browser and open a new blank page
async function start (puppeteer) {
  const browser = await puppeteer.launch({
      headless: false, // Must be false so you can manually solve CAPTCHA or 2FA
    });
  const page = await browser.newPage();
  //blockAssets(page);

  // Set screen size.
  await page.setViewport({width: 1080, height: 1024});

  var cookies;
  // Try to load session if it exists
  if (fs.existsSync(SESSION_FILE)) {
    cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.setCookie(...cookies);
    console.log('Session loaded from file.');
  }
  
  // Navigate the page to a URL.
  await page.goto('https://au.indeed.com/');


  await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Press Enter to exit...', () => {
        rl.close();
        resolve();
      });
    });

  console.log('Complete!');


//   // Save session (cookies)
//   const cookies = await page.cookies();
//   fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
//   console.log('Session saved to file.');

  await browser.close();
}
start(puppeteer);
