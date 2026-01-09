import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

// Map price IDs to their metadata
const PRICE_METADATA: Record<string, { type: 'subscription' | 'credits'; credits?: number; plan?: string; duration?: number }> = {
  // Subscriptions
  'price_1Sn7frBqCnLJvgINioGtjNlu': { type: 'subscription', plan: 'monthly' },
  'price_1Sn7h8BqCnLJvgINum0uluPA': { type: 'subscription', plan: 'semester', duration: 120 }, // 4 months in days
  'price_1Sn7o4BqCnLJvgINSjWw3ly8': { type: 'subscription', plan: 'annual', duration: 365 },
  // Credit packs
  'price_1Sn7pJBqCnLJvgINEwYx5kLI': { type: 'credits', credits: 25 },
  'price_1Sn7qWBqCnLJvgINLtBkKpkA': { type: 'credits', credits: 50 },
  'price_1Sn7rsBqCnLJvgINalcNIC0v': { type: 'credits', credits: 100 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, priceId, email, mode, successUrl, cancelUrl } = req.body;

    if (!userId || !priceId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const priceMeta = PRICE_METADATA[priceId];
    if (!priceMeta) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode === 'subscription' ? 'subscription' : 'payment',
      success_url: successUrl || `${req.headers.origin}/#/settings?payment=success`,
      cancel_url: cancelUrl || `${req.headers.origin}/#/settings?payment=cancelled`,
      metadata: {
        userId,
        priceId,
        ...priceMeta,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
}
