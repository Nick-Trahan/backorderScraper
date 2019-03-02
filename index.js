const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const fs = require('fs');

const HYUNDAI_DEALER_LOGIN =
'https://wdcs.hyundaidealer.com/irj/portal/iam?TargetSYS_ID=SYS0000';
const BACKORDER_PAGE =
'https://wdcs.hyundaidealer.com/irj/portal/webdcs#/parts_backOrder_rdrSearch';
const WEB_DCS =
'https://www.hyundaidealer.com/_layouts/SSOSharepointSolution/SSORedirect.aspx?id=WEBDCS_allowCU_V2';

(async () => {
  // Initiate the Puppeteer browser
  const browser = await puppeteer.launch(/*{ headless: false }*/);
  const page = await browser.newPage();

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
  // Reading cookies
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
  } else {
  // Writing cookies
  const cookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies));
  console.log(`Session has been saved to ${cookiesPath}`);
  }

  // Get to WebDCS and wait for it to load
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto(WEB_DCS, { waitUntil: 'networkidle2' });
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto(BACKORDER_PAGE, { waitUntil: 'networkidle2'});
  await page.waitFor(3000);
  await page.select('#gridlistbackorder_length > label > select', '100');

  const amountOfBackorders = await page.evaluate(() => {
    const resultText = document.querySelector('#printAreaDiv > article > div > div > div > header > h1').innerText;
    const resultNumber = Number(resultText.substring(16));

    return resultNumber;
  });

  const PART_NUMBER_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(1) > span > span:nth-child(1)';
  const ORDER_NUMBER_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(2) > span:nth-child(2)';
  const XVOR_STATUS_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(13) > a';

  for (let i = 1; i <= amountOfBackorders; i++) {
    let orderNumberSelector = ORDER_NUMBER_SELECTOR_PATH.replace('INDEX', i);
    let partNumberSelector = PART_NUMBER_SELECTOR_PATH.replace('INDEX', i);
    let xvorStatusSelector = XVOR_STATUS_SELECTOR_PATH.replace('INDEX', i);

    let orderNumbers = await page.evaluate((sel) => {
      let storeIndicatorString = document.querySelector(sel).innerText;
      let firstTwo = storeIndicatorString.substring(0, 2);

      if(firstTwo === 'H0' || firstTwo === 'H1') {
        return storeIndicatorString;
      } else {
        return 'Warehouse Order';
      }
    }, orderNumberSelector);

    let partNumbers = await page.evaluate((sel) => {
      let backorderedPart = document.querySelector(sel).innerText;
      return backorderedPart;
    }, partNumberSelector);

    let xvorStatus = await page.evaluate((sel) => {
      let statusIndicator = document.querySelector(sel);
      let elementText = '';
      (statusIndicator) ? elementText = statusIndicator.innerText : elementText = 'N/A';

      if(elementText === 'XVOR') {
        return 'Yes';
      } else if(elementText === 'N/A') {
        return 'N/A';
      } else {
        return 'No';
      }
    }, xvorStatusSelector);

    let relevantOrders = {
      partNumber: partNumbers,
      orderNumber: orderNumbers,
      upgraded: xvorStatus,
    };
    if(relevantOrders.orderNumber !=='Warehouse Order') {
      console.log(relevantOrders);
    }
   }
  // End session
  await browser.close();
})();
