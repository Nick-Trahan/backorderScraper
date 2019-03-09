const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const CONFIG = require('./config.js');
const Order = require('./models/orders');

const app = express();

// parse requests
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// connecting to the database
mongoose.connect(CONFIG.DB_URL, {
    useNewUrlParser: true,
    useFindAndModify: false
}).then(() => {
    console.log("Successfully connected to the database");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});

// listen on chosen port
app.listen(CONFIG.serverPort, () => {
    console.log(`Server is listening on port ${CONFIG.serverPort}`);
});

// default route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Order.find().lean().exec((err, backorders) => {
//     console.log(backorders);
// });

// pulling info from the database
app.get('/', (req, res) => {
  Order.find().lean().exec((err, backorders) => {
      // TODO
  });
})
