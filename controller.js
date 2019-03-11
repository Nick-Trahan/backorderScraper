const fs = require('fs');
const mongoose = require('mongoose');
const CONFIG = require('./config.js');
const Orders = require('./models/orders.js');

const dataFile = fs.readFileSync(CONFIG.jsonPath);
const backorderData = JSON.parse(dataFile);

// dataList is an array where each index is a different order
const dataList = backorderData.result.retData.dataList;

for (let i = 0; i < dataList.length; i++) {
  const orderNumber = dataList[i].DLRO;
  const firstTwo = orderNumber.substring(0, 2);

  if(firstTwo === 'H0' || firstTwo === "H1") {
    let backOrder = {
      partNumber: dataList[i].PART.trim(),
      orderNumber: dataList[i].DLRO,
      upgraded: 'N/A',
      details: 'N/A',
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
