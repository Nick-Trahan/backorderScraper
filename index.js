const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const fs = require('fs');

const HYUNDAI_DEALER_LOGIN = 
'https://wdcs.hyundaidealer.com/irj/portal/iam?TargetSYS_ID=SYS0000';
const PARTS_PAGE =
'https://www.hyundaidealer.com/parts/SitePages/Parts.aspx'
const BACKORDER_PAGE =
'https://wdcs.hyundaidealer.com/irj/portal/webdcs#/parts_backOrder_rdrSearch';
const WEB_DCS =
'https://www.hyundaidealer.com/_layouts/SSOSharepointSolution/SSORedirect.aspx?id=WEBDCS_allowCU_V2';

(async () => {
  // Initiate the Puppeteer browser
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setViewport({ width: 1200, height: 720 });

  // Go to the webpage and wait for it to load
  await page.goto(HYUNDAI_DEALER_LOGIN, { waitUntil: 'networkidle2' });

  // Log into website
  await page.type('#logondcodefield', CREDS.dealerCode);
  await page.type('#logonuidfield', CREDS.userID);
  await page.type('#logonpassfield', CREDS.password);

  // Click and wait for navigation
  await Promise.all([
    page.click('.urBtnStdNew'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);
  
  // Working with cookies
  //Reading cookies
  const cookiesPath = './cookies/cookies.txt'
  const previousSession = fs.existsSync(cookiesPath);
  if(previousSession) {
    const content = fs.readFileSync(cookiesPath);
    const cookiesArr = JSON.parse(content);
    if(cookiesArr.length !== 0) {
      for (let cookie of cookiesArr) {
        await page.setCookie(cookie);
      }
      console.log('Session has been loaded in the browser')
    }
  }
  // Writing cookies
  const cookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies));
  console.log(`Session has been saved to ${cookiesPath}`);

  // Get to WebDCS and wait for it to load
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto(WEB_DCS, { waitUntil: 'networkidle2' });
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  

  // End session
  await browser.close();
})();
