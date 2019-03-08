const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const CONFIG = require('./config.js');

const app = express();

// parse requests
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// connecting to the database
if(mongoose.connection.readyState === 0) {
    mongoose.connect(CONFIG.DB_URL, { 
        useNewUrlParser: true,
        useFindAndModify: false,
     }).then(() => {
         console.log('Successfully connected to the database');
         // listen on chosen port
         app.listen(CONFIG.serverPort, () =>{
             console.log(`Server is listening on port ${CONFIG.serverPort}`);
         });
     }).catch(err => {
         console.log('Could not connect to the database. Exiting now...', err);
         process.exit();
     });
}

// default route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// app.get('/', (req, res) => {
//   Order.find();
// })
