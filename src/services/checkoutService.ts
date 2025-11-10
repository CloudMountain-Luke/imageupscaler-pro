// Centralized Stripe Checkout launcher for the frontend
// Uses your Supabase Edge Function `create-checkout-session`
// Make sure you have VITE_API_URL and VITE_SUPABASE_ANON_KEY in your frontend .env
//   VITE_API_URL=https://<project>.supabase.co/functions/v1
//   VITE_SUPABASE_ANON_KEY=eyJ... (anon key)

export type PlanId = 'basic' | 'pro' | 'enterprise';

export class CheckoutError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'CheckoutError';
  }
}

function getFunctionsBaseUrl() {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (!base) throw new CheckoutError('Missing VITE_API_URL in frontend environment');
  return base.replace(/\/$/, '');
}

function getAnonKey() {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anon) throw new CheckoutError('Missing VITE_SUPABASE_ANON_KEY in frontend environment');
  return anon;
}

export async function startCheckout(plan: PlanId, user: { id: string; email: string }): Promise<never> {
  const base = getFunctionsBaseUrl();
  const anon = getAnonKey();

  const res = await fetch(`${base}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // These headers allow your public client to talk to the Edge Function
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ plan, customerEmail: user.email, userId: user.id }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new CheckoutError(detail || 'Failed to create checkout session', res.status);
  }

  const data = (await res.json()) as { url?: string };
  if (!data?.url) throw new CheckoutError('Checkout URL missing from server response');

  // Hard redirect to Stripe Hosted Checkout
  window.location.assign(data.url);
  // The above never resolves, but we mark the return type as never to reflect that
  throw new CheckoutError('Redirection was blocked by the browser');
}
