const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) { /* Netlify: env vars come from dashboard */ }

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors({ origin: ['http://localhost:3001', 'http://localhost:5173', 'https://bucketlistspots.com', 'https://www.bucketlistspots.com', process.env.URL].filter(Boolean) }));
app.use(express.json());

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { routeName, guideName, guideId, price, travelers, depositAmount, guestName, guestEmail, date } = req.body;

    const origin = req.headers.origin || 'http://localhost:3001';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: guestEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${routeName} with ${guideName}`,
              description: `${travelers} traveler(s) · ${date} · 20% deposit`,
            },
            unit_amount: depositAmount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        guideId,
        guideName,
        routeName,
        travelers: String(travelers),
        guestName,
        guestEmail,
        date,
      },
      success_url: `${origin}/checkout/${guideId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${guideId}?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3002, () => {
    console.log('Payment server running on http://localhost:3002');
  });
}

module.exports = app;
