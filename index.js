const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const CONFIG = require('./config.js');
const Order = require('./models/orders');
const fs = require('fs');
const mongoose = require('mongoose');

const HYUNDAI_DEALER_LOGIN =
'https://wdcs.hyundaidealer.com/irj/portal/iam?TargetSYS_ID=SYS0000';
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
   * TODO: This gets backorder info as a json file. Much simpler and faster
   * than my previous method.
   *
   * This is probably the most complicated way to do this, but it works for now!
   * I may be able to do this without puppeteer.
   */
  await page.goto(DATA_URL, { waitUntil: 'networkidle2'});
  const rawData = await page.content();
  await page.waitFor(3000);
  fs.writeFileSync(CONFIG.jsonPath, rawData.slice(25, rawData.length -14));
  console.log(`Backorder data saved to ${CONFIG.jsonPath}`);

  //   if(relevantOrders.orderNumber !=='Warehouse Order') {
  //     //console.log(relevantOrders);
  //     upsertOrder({
  //       partNumber: relevantOrders.partNumber,
  //       orderNumber: relevantOrders.orderNumber,
  //       upgraded: relevantOrders.upgraded,
  //       details: relevantOrders.details,
  //     });
  //   }
  // }
  // End session
  await browser.close();
  mongoose.connection.close();
})();

const dataFile = fs.readFileSync(CONFIG.jsonPath);
const backorderData = JSON.parse(dataFile);
// console.log(backorderData.result.retData.dataList[8].PART);

const dataList = backorderData.result.retData.dataList;
console.log(dataList[3].DLRO)

// for (let i = 1; i <= dataList.length; i++) {
//   const orderNumber = dataList[i].DLRO;

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
