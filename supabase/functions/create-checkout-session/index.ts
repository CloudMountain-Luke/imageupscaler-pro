import { Stripe } from 'npm:stripe@12';

// Initialize Stripe with your secret key
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const PRICE_IDS: Record<string, string> = {
  basic: Deno.env.get('STRIPE_PRICE_ID_BASIC')!,
  pro: Deno.env.get('STRIPE_PRICE_ID_PRO')!,
  enterprise: Deno.env.get('STRIPE_PRICE_ID_ENTERPRISE')!,
  mega: Deno.env.get('STRIPE_PRICE_ID_MEGA')!,
};

// Supabase Edge Function entry point
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    // Expect JSON: { plan: "pro", customerEmail: "...", userId: "..." }
    const { plan, customerEmail, userId } = await req.json();
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 });
    }

    // Create a subscription-mode Checkout Session that *requires* a card
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always', // ensure payment method is collected:contentReference[oaicite:2]{index=2}
      success_url: `${Deno.env.get('DOMAIN')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('DOMAIN')}/cancel`,
      subscription_data: {
        metadata: { userId }, // helpful for webhooks to update your DB
        // optional: set trial settings or trial_period_days here
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
});
