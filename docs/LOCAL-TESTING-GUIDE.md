# Script-Speech Local Testing Guide

**Date:** Feb 23, 2026  
**Purpose:** End-to-end testing of billing flow before production launch

---

## Prerequisites

### Services Required
- [ ] Supabase project (database)
- [ ] ElevenLabs API key
- [ ] Stripe test account
- [ ] Stripe CLI (for webhook testing)

### Environment Setup

```bash
# Copy the template
cp .env.local .env.local.backup

# Edit and fill in values
nano .env.local
```

**Required Variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# ElevenLabs
ELEVENLABS_API_KEY=sk_...

# Stripe Test Keys (from https://dashboard.stripe.com/test/apikeys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

---

## Step 1: Database Setup

### Apply Supabase Migrations

```bash
# Option 1: Via Supabase CLI (if installed)
supabase migration up

# Option 2: Manual SQL execution
# 1. Open Supabase dashboard
# 2. SQL Editor → New Query
# 3. Copy contents of: supabase/migrations/add_subscriptions_table.sql
# 4. Click "Run"
```

### Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'subscription_transactions');

-- Check subscriptions structure
\d public.subscriptions
```

### Verify RLS Policies

```sql
-- Should see 2 policies for subscriptions
SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
```

---

## Step 2: Start Development Server

```bash
npm run dev
# App should be available at http://localhost:3000
```

### Check Build Success

```bash
# In another terminal
curl http://localhost:3000 -I
# Should return 200
```

---

## Step 3: Test Authentication Flow

### Create Test User

```bash
# Via Supabase Dashboard:
# 1. Authentication → Users
# 2. Add user (email: test@example.com, password: Test@12345)
# OR via API:

curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@12345"
  }'
```

### Login & Get Token

```bash
# Via Supabase CLI
supabase auth signin test@example.com Test@12345

# OR via API
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@12345"
  }'

# Response includes: access_token (save this for testing)
```

---

## Step 4: Test Stripe Checkout

### Create Test Subscription

1. **Via Web UI:**
   - Visit http://localhost:3000/pricing
   - Click "Creator Plan" (or any tier)
   - Fill checkout form with test card

2. **Test Card Details (Stripe):**
   ```
   Card Number:  4242 4242 4242 4242
   Exp Date:     12/25
   CVC:          123
   ```

3. **Expected Result:**
   - Redirected to success page
   - Stripe log shows: `checkout.session.completed` event

---

## Step 5: Test Webhook Locally

### Start Stripe CLI

```bash
# Install if needed
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Start webhook forwarding to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This outputs:
```
> Ready! Your webhook signing secret is: whsec_test_...
```

**Update .env.local:**
```env
STRIPE_WEBHOOK_SECRET=whsec_test_...  # From stripe listen output
```

### Trigger Test Event

In another terminal:

```bash
# Create a test session
stripe fixtures --fixture payment_intent

# Or directly trigger checkout
stripe trigger payment_intent.succeeded
```

### Verify Webhook Received

```bash
# In server logs (npm run dev terminal):
# Should see:
# [Stripe Webhook] Event: checkout.session.completed
# [Stripe] Subscription created: sub_...
# [Stripe] Subscription saved to database
```

### Check Database

```sql
-- Verify subscription was created
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;

-- Should see:
-- user_id, stripe_subscription_id, tier, status='active', monthly_credits, etc.
```

---

## Step 6: Test Credit System

### Check User Credits (Before Generation)

```bash
# Get auth token (from Step 3)
export TOKEN="your_access_token_here"

# Check subscription
curl http://localhost:3000/api/subscriptions/me \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "tier": "creator",
#   "monthlyCredits": 10000,
#   "creditsUsed": 0,
#   "creditsRemaining": 10000
# }
```

### Test TTS Generation with Credits

```bash
# Generate speech
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world, this is a test of the text to speech system.",
    "voice": "adam"
  }'

# Response:
# {
#   "success": true,
#   "audio": "//NExAAjq1QIbAAU...",  (base64)
#   "characterCount": 57,
#   "voice": "adam"
# }
```

### Verify Credits Were Deducted

```bash
# Check credits again
curl http://localhost:3000/api/subscriptions/me \
  -H "Authorization: Bearer $TOKEN"

# Should show:
# "creditsUsed": 57,
# "creditsRemaining": 9943
```

### Test Insufficient Credits

```bash
# Try to generate with very long text (> remaining credits)
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "A" * 20000
  }'

# Should return 402 (Payment Required):
# {
#   "error": "Insufficient credits",
#   "creditsNeeded": 20000,
#   "creditsRemaining": 9943
# }
```

---

## Step 7: Test Monthly Reset

### Manually Trigger Payment Success Event

```bash
# Via Stripe CLI
stripe trigger invoice.payment_succeeded

# OR via API (if subscription exists)
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invoice.payment_succeeded",
    "data": {
      "object": {
        "subscription": "sub_..."  # From Step 4
      }
    }
  }'
```

### Verify Credits Reset

```bash
# Check subscription again
curl http://localhost:3000/api/subscriptions/me \
  -H "Authorization: Bearer $TOKEN"

# Should show:
# "creditsUsed": 0,  (RESET!)
# "creditsRemaining": 10000
```

---

## Step 8: Test Cancellation

### Via Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/subscriptions
2. Find subscription from Step 4
3. Click "Cancel subscription"

### Verify in Database

```sql
-- Check status
SELECT status, cancellation_date FROM subscriptions 
WHERE stripe_subscription_id = 'sub_...';

-- Should show:
-- status='cancelled', cancellation_date=now()
```

### Test Generation After Cancellation

```bash
# Try to generate (should fail)
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# Should return 402:
# "creditsRemaining": 0
```

---

## Step 9: Dashboard Verification

### Check Dashboard Values

1. Visit http://localhost:3000/dashboard
2. Verify shows:
   - [ ] Current tier (Creator)
   - [ ] Total credits (10,000)
   - [ ] Credits used (57)
   - [ ] Credits remaining (9,943)
   - [ ] Generation history

---

## Troubleshooting

### Webhook Not Triggering

**Problem:** Stripe CLI shows events but server logs don't show webhook handler

**Solution:**
```bash
# Restart dev server
npm run dev

# Check ngrok URL matches in Stripe
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Make sure STRIPE_WEBHOOK_SECRET is set
echo $STRIPE_WEBHOOK_SECRET
```

### Database Error: "subscriptions" table not found

**Solution:**
```bash
# Re-apply migrations
supabase migration up --local

# OR manually execute SQL from:
# supabase/migrations/add_subscriptions_table.sql
```

### Credit Check Always Fails

**Problem:** hasEnoughCredits() returning false even with credits

**Solution:**
```bash
# Check subscription exists
SELECT * FROM subscriptions WHERE user_id = 'user_...';

# If empty, user doesn't have subscription
# Create one via checkout flow first
```

### Bearer Token Invalid

**Problem:** 401 on /api/tts/generate

**Solution:**
```bash
# Verify token format
echo $TOKEN | jq -R 'split(".") | .[1] | @base64d | fromjson'

# Create new token via login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@12345"
  }'
```

---

## Success Criteria

When ALL of the following are true, you're ready for production:

- [ ] Supabase tables created
- [ ] Webhook received and logged
- [ ] Subscription saved to database
- [ ] Credits deducted after generation
- [ ] Insufficient credit error shows
- [ ] Monthly reset works
- [ ] Cancellation marks subscription inactive
- [ ] Dashboard shows correct values
- [ ] All Stripe events processed

---

## Next Steps

Once local testing is complete:

1. **Deploy to Staging:**
   ```bash
   git push origin main
   # Vercel auto-deploys
   ```

2. **Test in Staging:**
   - Repeat steps 3-9 with production-like data
   - Use Stripe live keys (test mode)

3. **Production Launch:**
   - Switch to real Stripe keys
   - Announce on ProductHunt
   - Monitor logs and metrics

---

**Estimated Time:** 2-3 hours for full testing  
**Next Update:** After completing all test steps
