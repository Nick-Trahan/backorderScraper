const Order = require('./models/orders.js');

exports.findAll = (req, res) => {
    Order.find()
    .then(orders => {
        res.send(orders);
    }).catch(err => {
        res.status(500).send({
            message: err.message || 'Something went wrong while retrieving orders.'
        });
    });

};