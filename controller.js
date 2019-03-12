const fs = require('fs');
const mongoose = require('mongoose');
const request = require('request');
const CONFIG = require('./config.js');
const Orders = require('./models/orders.js');

const dataFile = fs.readFileSync(CONFIG.jsonPath);
const backorderData = JSON.parse(dataFile);

// dataList is an array where each index is a different order
const dataList = backorderData.result.retData.dataList;

// const query = 'https://wdcs.hyundaidealer.com/irj/servlet/prt/portal/prtroot/com.hma.webdcs.parts.backOrder.BackOrderSearchController?prtmode=getBackOrderETASearch&ADLO=LA0269C069&APDC=MW2&DLRO=H0311EO&KSFX=0&LINE=11&LSFX=0&ORDC=317&PART=243502GGB0+++++++++&PDCC=MW2&QTYB=1&dealer=LA026'

// const options = {
//   url: query,
//   json: true,
//   method: 'POST',
//   // jar: jar,
//   headers: {
//     Cookie: '',
//     Referer: 'https://wdcs.hyundaidealer.com/irj/portal/webdcs',
//     'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36'
//   },
// }
// request(options, (error, response, body) => {
//   const details = body.result.retData.dataList[0].SRC_DESCR;
//   console.log(details);
// });
let status = {};

for (let i = 0; i < dataList.length; i++) {
  const ETA_QUERY_URL = `https://wdcs.hyundaidealer.com/irj/servlet/prt/portal/prtroot/com.hma.webdcs.parts.backOrder.BackOrderSearchController?prtmode=getBackOrderETASearch&ADLO=${dataList[i].ADLO}&APDC=${dataList[i].APDC}&DLRO=${dataList[i].DLRO}&KSFX=${dataList[i].KSFX}&LINE=${dataList[i].LINE}&LSFX=${dataList[i].LSFX}&ORDC=${dataList[i].ORDC}&PART=${dataList[i].PART}&PDCC=${dataList[i].PDCC}&QTYB=${dataList[i].QTYB}&dealer=LA026`

  const options = {
    url: ETA_QUERY_URL,
    json: true,
    method: 'POST',
    // jar: jar,
    headers: {
      Cookie: '',
      Referer: 'https://wdcs.hyundaidealer.com/irj/portal/webdcs',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36'
    },
  }

  let testStr = '';
  request(options, (error, response, body) => {
    const details = body.result.retData.dataList[0].SRC_DESCR;
    testStr = (i + ' ' + details);
    // console.log(testStr);
    status[i] = testStr;
    console.log(status);
  });

  const orderNumber = dataList[i].DLRO;
  const firstTwo = orderNumber.substring(0, 2);
  
  if(firstTwo === 'H0' || firstTwo === "H1") {
    const upgradeIndicator = dataList[i].UPGR;
    let upgradeStatus = '';

    if(upgradeIndicator === 'E' || upgradeIndicator === 'X') {
      upgradeStatus = 'No';
    } else if (upgradeIndicator === 'I') {
      upgradeStatus = 'Yes';
    } else {
      upgradeStatus = 'N/A';
    }

    const backOrder = {
      partNumber: dataList[i].PART.trim(),
      orderNumber: dataList[i].DLRO,
      upgraded: upgradeStatus,
      details: status,
    };
    console.log(backOrder);
  }
}

function upsertOrder(orderObject) {
  if(mongoose.connection.readyState === 0) {
    mongoose.connect(CONFIG.DB_URL, { useNewUrlParser: true, useFindAndModify: false });
  }

  const conditions = { partNumber: orderObject.partNumber, orderNumber: orderObject.orderNumber };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  Orders.findOneAndUpdate(conditions, orderObject, options, (err, result) => {
    if(err) throw err;
  });
}

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
