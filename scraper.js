const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
// Or import puppeteer from 'puppeteer-core';

const DOMAIN = 'https://flaemestl.wordpress.com/mental-otome/v4ch39/';


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
      headless: true, // Must be false so you can manually solve CAPTCHA or 2FA
    });
  const page = await browser.newPage();
  blockAssets(page);

  // Set screen size.
  await page.setViewport({width: 1080, height: 1024});
  
  // Navigate the page to a URL.
  await page.goto(DOMAIN);

  var nextPage = true;
  var count =38;
  while (nextPage) {

    count += 1;
    console.log('Page ' + count);
    const title = await page.$eval('h2.wp-block-post-title', el => el.innerText);
    fs.appendFileSync('content.txt', title, 'utf-8');
    const htmlContent = await page.evaluate(() => {
      const container = document.querySelector('div.entry-content.wp-block-post-content');
      const stopTag = 'HR'; // Stop at first <hr>

      let result = '';
      for (let child of container.children) {
        if (child.tagName === stopTag) break;
        result += child.innerText + '\n';
      }

      return result.trim();
    }, el => el.innerText);
    
    fs.appendFileSync('content.txt', htmlContent, 'utf-8');

    fs.appendFileSync('content.txt', "\n------------------ \n", 'utf-8');

    const nextButton = await page.evaluate(() => {
      const xpath = "//a[contains(text(), 'Next page >>')]";
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const node = result.singleNodeValue;
      return node ? node.href : null;
    });
    //console.log(nextButton);
    if (nextButton) {
      await page.goto(nextButton);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
      console.log('Next page...');
    }
    else {
      nextPage =false;
      console.log(`End of search, went through: ${count} chapters!`);
    }
  }
  console.log("duhsiavd");
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

  await browser.close();
}
start(puppeteer);
