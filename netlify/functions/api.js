const Stripe = require('stripe');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { routeName, guideName, guideId, price, travelers, depositAmount, guestName, guestEmail, date } = JSON.parse(event.body);
    const origin = event.headers.origin || event.headers.host || 'https://bucketlistspots.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: guestEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${routeName} with ${guideName}`,
            description: `${travelers} traveler(s) · ${date} · 20% deposit`,
          },
          unit_amount: depositAmount * 100,
        },
        quantity: 1,
      }],
      metadata: { guideId, guideName, routeName, travelers: String(travelers), guestName, guestEmail, date },
      success_url: `${origin}/checkout/${guideId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${guideId}?payment=cancel`,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
