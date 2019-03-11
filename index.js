const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const CONFIG = require('./config.js');
const Order = require('./models/orders');
const fs = require('fs');
const mongoose = require('mongoose');

const HYUNDAI_DEALER_LOGIN =
'https://wdcs.hyundaidealer.com/irj/portal/iam?TargetSYS_ID=SYS0000';
const BACKORDER_PAGE =
'https://wdcs.hyundaidealer.com/irj/portal/webdcs#/parts_backOrder_rdrSearch';
const WEB_DCS =
'https://www.hyundaidealer.com/_layouts/SSOSharepointSolution/SSORedirect.aspx?id=WEBDCS_allowCU_V2';

const DATA_URL = 'https://wdcs.hyundaidealer.com/irj/servlet/prt/portal/prtroot/com.hma.webdcs.parts.backOrder.BackOrderSearchController?prtmode=getBackOrderSearch&VIEW=0&controlNo=&dealer=LA026&dealerCode=LA026&defaultView=true&fromdt=&fromdt400=&hmaNo=&invoiceno=&orderId=&orderNo=&orderStatus=&orderTyp=&part=&partNo=&pdcCode=&shipno=&todt=&todt400=';

(async () => {
  // Initiate the Puppeteer browser
  const browser = await puppeteer.launch(/*{headless: false}*/);
  const page = await browser.newPage();

  /**
   * The viewport must be set, even in headless mode, due to the responsive
   * design of the website. The default viewport will cause you to get the
   * mobile version of the site, which would require many more 'click'
   * actions to get to the relevant info.
   */
  await page.setViewport({ width: 1200, height: 720 });

  // Go to the webpage and wait for it to load
  console.log('Logging into HyundaiDealer.com');
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
  }
  // Writing cookies
  const cookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies));
  console.log(`Session has been saved to ${cookiesPath}`);

  // Get to WebDCS and wait for it to load
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Entering WebDCS...(Be patient, this may take a while)');
  await page.goto(WEB_DCS, { waitUntil: 'networkidle2' });
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('WebDCS loaded!');

  /**
   * TODO: This gets backorder info as a json file. Much simpler than my
   * previous method. I probably don't even need puppeteer anymore!
   * Too sleepy to try now. Future Nick, get on it!
   *
   * This is probably the most complicated way to do this, but it works for now!
   */
  await page.goto(DATA_URL, { waitUntil: 'networkidle2'});
  const data = await page.content();
  console.log(JSON.parse(data.slice(25, data.length -14)));

  await page.goto(BACKORDER_PAGE, { waitUntil: 'networkidle2'});
  await page.waitFor(3000);
  await page.select('#gridlistbackorder_length > label > select', '100');

  // const testData = await page.evaluate ( () => {
  //   const DATA_URL = 'https://wdcs.hyundaidealer.com/irj/servlet/prt/portal/prtroot/com.hma.webdcs.parts.backOrder.BackOrderSearchController?prtmode=getBackOrderSearch&VIEW=0&controlNo=&dealer=LA026&dealerCode=LA026&defaultView=true&fromdt=&fromdt400=&hmaNo=&invoiceno=&orderId=&orderNo=&orderStatus=&orderTyp=&part=&partNo=&pdcCode=&shipno=&todt=&todt400=';

  //   const request = new XMLHttpRequest();

  //   request.open('GET', DATA_URL);

  //   request.responseType = 'json';
  //   request.send();

  //   request.onload = () => {
  //     const backorderData = request.response;
  //     return backorderData;
  //   }
  // });

  // console.log(testData);

  // Check total amount of backorders
  console.log("Retrieving backorders...(This also takes a while. You'll be returned to the command prompt when it's done)");
  const amountOfBackorders = await page.evaluate(() => {
    const resultText = document.querySelector('#printAreaDiv > article > div > div > div > header > h1').innerText;
    const resultNumber = Number(resultText.substring(16));

    return resultNumber;
  });

  const PART_NUMBER_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(1) > span > span:nth-child(1)';
  const ORDER_NUMBER_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(2) > span:nth-child(2)';
  const XVOR_STATUS_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(13) > a';
  const DETAILS_LINK_SELECTOR_PATH = '#gridlistbackorder > tbody > tr:nth-child(INDEX) > td:nth-child(9) > a';

  for (let i = 1; i <= amountOfBackorders; i++) {
    const orderNumberSelector = ORDER_NUMBER_SELECTOR_PATH.replace('INDEX', i);
    const partNumberSelector = PART_NUMBER_SELECTOR_PATH.replace('INDEX', i);
    const xvorStatusSelector = XVOR_STATUS_SELECTOR_PATH.replace('INDEX', i);
    const detailsLinkSelector = DETAILS_LINK_SELECTOR_PATH.replace('INDEX', i);

    /**
     * 'storeIndicatorString' refers to the first two characters on the order
     * number. H0 and H1 would mean the order originated from my store
     * (the dealership), while anything else indicates the order was placed by
     * our wholesale division or was forced out by Hyundai.
     */
    const orderNumbers = await page.evaluate((sel) => {
      const storeIndicatorString = document.querySelector(sel).innerText;
      const firstTwo = storeIndicatorString.substring(0, 2);

      if(firstTwo === 'H0' || firstTwo === 'H1') {
        return storeIndicatorString;
      } else {
        return 'Warehouse Order';
      }
    }, orderNumberSelector);

    const partNumbers = await page.evaluate((sel) => {
      const backorderedPart = document.querySelector(sel).innerText;
      return backorderedPart;
    }, partNumberSelector);

    /**
     * This is to check if a part is eligible to be upgraded to XVOR
     * (eXpedite, Vehicle Off-road) and its upgrade status.
     */
    const xvorStatus = await page.evaluate((sel) => {
      const statusIndicator = document.querySelector(sel);
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

    const checkOrderDetails = await page.evaluate(async (sel) => {
      const detailsIndicator = document.querySelector(sel);
      const modalExit = document.querySelector('#parts_dialog_backorder_eta > div > div > div.modal-header > button > span');
      /**
       * The information we're after is located within a pop-up modal, so this
       * block will click the details link, pull the needed info, then close
       * the modal window.
       */
      if(detailsIndicator) {
        detailsIndicator.click();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const detailsField = document.querySelector('#DataTables_Table_0 > tbody > tr > td.mn-width-200.data-align-left');
        let etaDetails = '';

        // Sometimes, the details field is empty, so this will account for that.
        if(detailsField.innerText === '') {
          etaDetails = 'NONE';
        } else {
          etaDetails = detailsField.innerText;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        await modalExit.click();

        return etaDetails;

        /**
         * If a details link doesn't exist, the function returns NONE and
         * moves on.
         */
      } else {
        return 'NONE';
      }
    }, detailsLinkSelector);

    await page.waitFor(2000);

    // Return only the information relevant to the report.
    const relevantOrders = {
      partNumber: partNumbers,
      orderNumber: orderNumbers,
      upgraded: xvorStatus,
      details: checkOrderDetails,
    };

    if(relevantOrders.orderNumber !=='Warehouse Order') {
      //console.log(relevantOrders);
      upsertOrder({
        partNumber: relevantOrders.partNumber,
        orderNumber: relevantOrders.orderNumber,
        upgraded: relevantOrders.upgraded,
        details: relevantOrders.details,
      });
    }
   }
  // End session
  await browser.close();
  mongoose.connection.close();
})();

function upsertOrder(orderObject) {
  //TODO: This should probably come from the server file
  if(mongoose.connection.readyState === 0) {
    mongoose.connect(CONFIG.DB_URL, { useNewUrlParser: true, useFindAndModify: false });
  }

  const conditions = { partNumber: orderObject.partNumber, orderNumber: orderObject.orderNumber };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  Order.findOneAndUpdate(conditions, orderObject, options, (err, result) => {
    if(err) throw err;
  });
}

/**
 * Thanks to emadehsan (https://github.com/emadehsan) for writing such an
 * excellent guide for first timers using puppeteer for web scraping!
 * https://github.com/emadehsan/thal/blob/master/README.md
 */

 /**
  * https://zellwk.com/blog/crud-express-mongodb/
  * https://www.zeptobook.com/how-to-create-restful-crud-api-with-node-js-mongodb-and-express-js/
  */

  /**
   * TODO: Sometimes, the script will exit with no errors before checking any
   * orders. This usually happens after I empty the db while testing something
   * else.
   */
