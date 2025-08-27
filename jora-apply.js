const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
const { getTransitTime } = require("./google-map-api");
require('dotenv').config();

const SESSION_FILE = './session.json';
const DOMAIN = 'https://au.jora.com';

const avoidList=["cook", "chef", "manager", "kitchen", "massage", "delivery",
  "head", "driver", "factory", "worker", "nail", "beauty", "baker", "leader"];
const containList=["retail", "sale", "wait", "reception", "front", "desk", "IT", 
  "customer", "representative", "service", "pharma", "cafe", "bartender", "FOH", "sushi", 
  "team member", "assistant", "mechanic", "attendant", "tutor", "learn", "cashier", 
  "crew member", "packer", "Business"];
  const homeAddress = process.env.HOME_ADDRESS

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
  await page.goto('https://au.jora.com/j?a=48h&disallow=true&l=Oakleigh+VIC&pt=unseen&q=&qa=y&r=15&sp=facet_distance&st=date');

  async function isSuitable(result, avoidList, containList) {
    try{
      const title = await result.$eval('h2.job-title.heading', el => el.innerText);
      console.log(`Title: ${title}`);
      for(unwanted of avoidList) {
        if (title.toLowerCase().includes(unwanted.toLowerCase())) {
          return false;
        }
      }
      const status = await result.$eval('div.first-row div.content', el => el.innerText);
      console.log(`Status: ${status}`);
      if (status == 'Applied') {
        return false;
      }
      //Choose keywords
      for(keyword of containList) {
        if (!title.toLowerCase().includes(keyword.toLowerCase())) {
          return false;
        }
      }

      const workAddress = await result.$eval('a.job-location.clickable-link', el => el.innerText);
      if(homeAddress && workAddress){
        const commuteTime = await getTransitTime(homeAddress, workAddress);

        console.log('Commute Time:', commuteTime.text);
        if (commuteTime.seconds >2400) return false; //40 minutes
      }
      else return false;

      
    }
    catch(error) {
      console.error(error);
    }
    return true;
  }

  var nextPage = true;
  var count =0, jobApplied = 0;
  while (nextPage) {

    count += 1;
    const results = await page.$$('div.job-card.result');
    for (const result of results) {
      if (!await isSuitable(result, avoidList, containList)) {
        console.log("Skipped!\n");
        continue;
      }
      await result.click();
      const quickApply = await page.$('a.rounded-button.-primary.-w-full[data-js-quick-apply="true"]');
      const href = await page.evaluate(el => el.getAttribute('href'), quickApply);
      //console.log(`Apply link: ${href}.`);

      const npJob = await browser.newPage();
      await npJob.setCookie(...cookies);
      blockAssets(npJob);
      await npJob.goto(DOMAIN+href);
      const checkboxNotify = await npJob.$('input[name="notifyMeWithSimilarJob"]');
      if (checkboxNotify) {
        checkboxNotify.click();
      }
      const submitButton = await npJob.$('button[type="submit"]');
      if(submitButton){
        const statusReport = await npJob.evaluate(el => el.innerText, submitButton);
        if(statusReport == 'Apply with profile'){
          jobApplied+=1;
          submitButton.click();
          console.log('Form submitted!!!!!!!!!!!!!!!\n');
          await npJob.waitForNavigation({ waitUntil: 'networkidle0' });
        }
      }
      
      await npJob.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
      await npJob.close();
    }
    const nextButton = await page.$('a.next-page-button[rel="nofollow"]');
    if (nextButton) {
      nextButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 600000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
      console.log('Next page...');
    }
    else {
      nextPage =false;
      console.log(`End of search, went through: ${count} pages. Applied: ${jobApplied} jobs`);
    }
  }

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
