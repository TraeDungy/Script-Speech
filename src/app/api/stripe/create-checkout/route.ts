import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Pricing tiers
const PRICING = {
  creator: {
    priceId: process.env.STRIPE_PRICE_CREATOR || '',
    credits: 10000, // characters
    name: 'Creator',
    price: 1000, // cents ($10)
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO || '',
    credits: 50000,
    name: 'Pro',
    price: 5000, // $50
  },
  agency: {
    priceId: process.env.STRIPE_PRICE_AGENCY || '',
    credits: -1, // unlimited
    name: 'Agency',
    price: 50000, // $500
  },
};

export async function POST(req: NextRequest) {
  try {
    const { tier = 'creator', userId, email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const plan = PRICING[tier as keyof typeof PRICING];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Script-Speech ${plan.name}`,
              description: `${plan.credits === -1 ? 'Unlimited' : plan.credits.toLocaleString()} characters/month`,
            },
            unit_amount: plan.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        tier,
        credits: plan.credits.toString(),
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('[Stripe Checkout Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// Verify subscription status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      status: session.status,
      subscription: session.subscription,
      metadata: session.metadata,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}