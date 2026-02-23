-- Create subscriptions table for Script-Speech billing

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  tier text not null check (tier in ('creator', 'pro', 'agency')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled', 'expired')),
  monthly_credits bigint not null default 10000,
  credits_used_this_month bigint not null default 0,
  billing_cycle_start timestamp with time zone not null default now(),
  billing_cycle_end timestamp with time zone not null default (now() + interval '1 month'),
  last_payment_date timestamp with time zone,
  next_billing_date timestamp with time zone,
  cancellation_date timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  constraint fk_user_id foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create indexes for faster queries
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_subscription_id on public.subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_stripe_customer_id on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- Enable RLS (Row Level Security)
alter table public.subscriptions enable row level security;

-- Create RLS policies
-- Users can only read their own subscription
create policy "Users can read their own subscriptions"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Only service role can insert/update/delete (for server-side operations)
create policy "Service role can manage subscriptions"
  on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Create trigger to update updated_at timestamp
create or replace function public.update_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at_trigger
  before update on public.subscriptions
  for each row
  execute function public.update_subscriptions_updated_at();

-- Add credits tracking table for audit log
create table if not exists public.subscription_transactions (
  id uuid default gen_random_uuid() primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('generation', 'refund', 'bonus', 'manual_adjust')),
  credits_change bigint not null,
  reason text,
  created_at timestamp with time zone not null default now()
);

-- Create indexes for transaction tracking
create index if not exists idx_subscription_transactions_subscription_id on public.subscription_transactions(subscription_id);
create index if not exists idx_subscription_transactions_user_id on public.subscription_transactions(user_id);
create index if not exists idx_subscription_transactions_created_at on public.subscription_transactions(created_at);

-- Enable RLS for transactions
alter table public.subscription_transactions enable row level security;

-- Create RLS policies for transactions
create policy "Users can read their own transaction history"
  on public.subscription_transactions
  for select
  using (auth.uid() = user_id);

create policy "Service role can manage transactions"
  on public.subscription_transactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
