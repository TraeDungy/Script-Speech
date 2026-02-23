import { createClient } from '@supabase/supabase-js';
import { Database } from './generated.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired';
export type TierType = 'creator' | 'pro' | 'agency';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  tier: TierType;
  status: SubscriptionStatus;
  monthly_credits: number;
  credits_used_this_month: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  last_payment_date: string | null;
  next_billing_date: string | null;
  cancellation_date: string | null;
  created_at: string;
  updated_at: string;
}

const TIER_CREDITS: Record<TierType, number> = {
  creator: 10000,
  pro: 100000,
  agency: 1000000,
};

/**
 * Create a new subscription in the database
 */
export async function createSubscription(
  userId: string,
  data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    tier: TierType;
  }
): Promise<Subscription> {
  const now = new Date();
  const billingCycleEnd = new Date(now);
  billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_subscription_id: data.stripeSubscriptionId,
      stripe_customer_id: data.stripeCustomerId,
      tier: data.tier,
      status: 'active',
      monthly_credits: TIER_CREDITS[data.tier],
      credits_used_this_month: 0,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: billingCycleEnd.toISOString(),
      next_billing_date: billingCycleEnd.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return subscription as Subscription;
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return (data as Subscription) || null;
}

/**
 * Get subscription by user ID
 */
export async function getSubscriptionByUserId(
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return (data as Subscription) || null;
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: SubscriptionStatus
): Promise<Subscription> {
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  // If marking as cancelled, set the cancellation date
  if (status === 'cancelled') {
    updates.cancellation_date = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Reset monthly credits and update billing cycle
 */
export async function resetMonthlyCredits(
  stripeSubscriptionId: string
): Promise<Subscription> {
  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  const nextBillingDate = new Date(subscription.billing_cycle_end);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      credits_used_this_month: 0,
      billing_cycle_start: subscription.billing_cycle_end,
      billing_cycle_end: nextBillingDate.toISOString(),
      last_payment_date: now.toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reset credits: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Add credits used to subscription
 */
export async function addCreditsUsed(
  userId: string,
  charactersUsed: number
): Promise<Subscription> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const newCreditsUsed =
    subscription.credits_used_this_month + charactersUsed;

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      credits_used_this_month: newCreditsUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update credits used: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Get remaining credits for user
 */
export async function getRemainingCredits(userId: string): Promise<number> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription) {
    return 0;
  }

  return subscription.monthly_credits - subscription.credits_used_this_month;
}

/**
 * Check if user has enough credits for generation
 */
export async function hasEnoughCredits(
  userId: string,
  charactersNeeded: number
): Promise<boolean> {
  const remaining = await getRemainingCredits(userId);
  return remaining >= charactersNeeded;
}

/**
 * Mark subscription as past due
 */
export async function markAsPastDue(
  stripeSubscriptionId: string
): Promise<Subscription> {
  return updateSubscriptionStatus(stripeSubscriptionId, 'past_due');
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<Subscription> {
  return updateSubscriptionStatus(stripeSubscriptionId, 'cancelled');
}

/**
 * Get subscription details with remaining credits
 */
export async function getSubscriptionDetails(
  userId: string
): Promise<Subscription & { creditsRemaining: number }> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const creditsRemaining = subscription.monthly_credits - subscription.credits_used_this_month;

  return {
    ...subscription,
    creditsRemaining,
  };
}
