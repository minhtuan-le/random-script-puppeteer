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
  "crew member", "packer", "Business", "staff", "coordinator", "teacher", "educator"];
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

  let cookies;
  // Try to load session if it exists
  if (fs.existsSync(SESSION_FILE)) {
    cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.setCookie(...cookies);
    console.log('Session loaded from file.');
  }
  
  // Navigate the page to a URL.
  await page.goto('https://au.jora.com/j?a=48h&disallow=true&l=Oakleigh+VIC&q=&qa=y&r=10&sp=facet_distance&st=date');

  async function isSuitable(result, avoidList, containList) {
    try{
      const title = await result.$eval('h2.job-title.heading', el => el.innerText);
      console.log(`Title: ${title}`);
      for(unwanted of avoidList) {
        if (title.toLowerCase().includes(unwanted.toLowerCase())) {
          return {
            suitability:false,
            reason: "In avoid list"
          };
        }
      }
      const status = await result.$eval('div.first-row div.content', el => el.innerText);
      //console.log(`Status: ${status}`);
      if (status == 'Applied') {
        return {
            suitability:false,
            reason: "Already applied"
          };
      }
      //Choose keywords
      hasKeyword = false;
      for(keyword of containList) {
        if (title.toLowerCase().includes(keyword.toLowerCase())) {
          hasKeyword= true;
          continue;
        }
      }
      if (!hasKeyword){
        return {
          suitability:false,
          reason: "Does not contain required key words"
        };
      }      

      workAddress = await result.$eval('a.job-location.clickable-link', el => el.innerText);
      const workCompany = await result.$eval('span.job-company', el => el.innerText);
      if(homeAddress && workAddress){
        if (workCompany){
          workAddress = workCompany + ', ' + workAddress
        }
        const commuteTime = await getTransitTime(homeAddress, workAddress);

        //console.log('Commute Time:', commuteTime.text);
        if (commuteTime.seconds >2400) //40 minutes
          return {
            suitability:false,
            reason: `Too far away, distance: ${commuteTime.text}`
          }; 
      }
      else return {
        suitability:false,
        reason: "Cannot find address"
      };

      
    }
    catch(error) {
      console.error(error);
    }
    return {
      suitability:true
    };
  }

  nextPage = true;
  count =0, jobApplied = 0;
  while (nextPage) {

    count += 1;
    const results = await page.$$('div.job-card.result');
    for (const result of results) {
      const checkSuitability = await isSuitable(result, avoidList, containList)
      if (!checkSuitability.suitability) {
        console.log(`Skipped --- ${checkSuitability.reason}\n`);
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

  await browser.close();
}
start(puppeteer);
