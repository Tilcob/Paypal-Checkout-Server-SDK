'use strict';

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express'),
      paypal = require('@paypal/checkout-server-sdk');

const app = express();

const Environment = process.env.NODE_ENV === 'production'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

const storeItems = new Map([
    [1, { price: 100, name: 'foo 1' }],
    [2, { price: 200, name: 'foo 2' }]
]);

app.get('/', (req, res) => {
    res.render('index.ejs', {
        paypalClientID: process.env.PAYPAL_CLIENT_ID
    });
});

app.post('/create-order', async (req, res) => {
    const request = new paypal.orders.OrdersCreateRequest();
    const total = req.body.items.reduce((sum, item) => {
        return sum + storeItems.get(item.id).price * item.quantity;
    }, 0);

    request.prefer("return=representation");

    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'EUR',
                value: total,
                tax_total: {}, // If there are taxes
                breakdown: {
                    item_total: {
                        currency_code: 'EUR',
                        value: total
                    }
                }
            },
            items: req.body.items.map(item => {
                const storeItem = storeItems.get(item.id);

                return {
                    name: storeItem.name,
                    unit_amount: {
                        currency_code: 'EUR',
                        value: storeItem.price
                    },
                    quantity: item.quantity
                }
            })
        }]
    });

    try {
        const order = await paypalClient.execute(request);
        res.json({ id: order.result.id });
    } catch (e) {
        res.sendStatus(500).json({ error: e.message });
    }
});

app.listen(8080);