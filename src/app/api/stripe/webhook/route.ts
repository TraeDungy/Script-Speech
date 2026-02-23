import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  createSubscription,
  getSubscriptionByStripeId,
  updateSubscriptionStatus,
  resetMonthlyCredits,
  markAsPastDue,
  cancelSubscription,
} from '@/lib/db/subscriptions';

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
        const { userId, tier } = session.metadata || {};
        const customerId = session.customer as string;
        
        console.log(`[Stripe] Subscription created: ${session.subscription}`);
        console.log(`[Stripe] User: ${userId}, Tier: ${tier}`);
        
        if (!userId || !tier || !session.subscription) {
          console.error('[Stripe] Missing required metadata');
          break;
        }

        try {
          await createSubscription(userId, {
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: customerId,
            tier: tier as 'creator' | 'pro' | 'agency',
          });
          console.log(`[Stripe] Subscription saved to database`);
        } catch (error) {
          console.error('[Stripe] Error saving subscription:', error);
        }
        
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        console.log(`[Stripe] Payment succeeded for subscription: ${subscriptionId}`);
        
        try {
          await resetMonthlyCredits(subscriptionId);
          await updateSubscriptionStatus(subscriptionId, 'active');
          console.log(`[Stripe] Monthly credits reset and subscription marked active`);
        } catch (error) {
          console.error('[Stripe] Error resetting credits:', error);
        }
        
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        console.log(`[Stripe] Payment failed for subscription: ${subscriptionId}`);
        
        try {
          await markAsPastDue(subscriptionId);
          // TODO: Send notification email to user
          console.log(`[Stripe] Subscription marked as past_due`);
        } catch (error) {
          console.error('[Stripe] Error marking as past due:', error);
        }
        
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        console.log(`[Stripe] Subscription cancelled: ${subscription.id}`);
        
        try {
          await cancelSubscription(subscription.id);
          console.log(`[Stripe] Subscription marked as cancelled in database`);
        } catch (error) {
          console.error('[Stripe] Error cancelling subscription:', error);
        }
        
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