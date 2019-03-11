const mongoose = require('mongoose');

let orderSchema = new mongoose.Schema({
  partNumber: String,
  orderNumber: String,
  upgraded: String,
  details: String,
},{
  timestamps: true,
});

let Order = mongoose.model('Order', orderSchema);

module.exports = Order;
