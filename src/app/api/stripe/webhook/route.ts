import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Invalid signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, tier, credits } = session.metadata || {};
        
        console.log(`[Stripe] Subscription created: ${session.subscription}`);
        console.log(`[Stripe] User: ${userId}, Tier: ${tier}, Credits: ${credits}`);
        
        // TODO: Update database with subscription info
        // await db.subscriptions.create({
        //   userId,
        //   stripeSubscriptionId: session.subscription,
        //   tier,
        //   credits: parseInt(credits || '0'),
        //   status: 'active',
        // });
        
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        console.log(`[Stripe] Payment succeeded for subscription: ${subscriptionId}`);
        
        // TODO: Reset monthly credits
        // await db.subscriptions.updateCredits(subscriptionId);
        
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        console.log(`[Stripe] Payment failed for subscription: ${subscriptionId}`);
        
        // TODO: Mark subscription as past_due, send notification
        // await db.subscriptions.updateStatus(subscriptionId, 'past_due');
        
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        console.log(`[Stripe] Subscription cancelled: ${subscription.id}`);
        
        // TODO: Mark subscription as cancelled
        // await db.subscriptions.updateStatus(subscription.id, 'cancelled');
        
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Disable body parsing for raw payload
export const config = {
  api: {
    bodyParser: false,
  },
};