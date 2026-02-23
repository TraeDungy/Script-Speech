# Stripe Setup for Script-Speech

**Date:** Feb 23, 2026  
**Status:** Production-ready configuration

---

## 1. Stripe Account Setup

### Create Account
1. Visit https://stripe.com
2. Sign up with email
3. Verify account (email confirmation)

### Get API Keys
1. Dashboard: https://dashboard.stripe.com
2. Developers → API Keys (top right)
3. Under "Test data" toggle:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)

**⚠️ SECURITY:**
- Never commit keys to git
- Never share secret key
- Store in `.env.local` only
- Rotate keys regularly (monthly)

---

## 2. Environment Variables

### Add to .env.local

```env
# Stripe Test Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_... # Set after webhook creation
```

### Verify Setup

```bash
# Test connectivity
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" \
  https://api.stripe.com/v1/account

# Should return account details (200 OK)
```

---

## 3. Products & Pricing Setup

### Create Products

**1. Creator Plan**
1. Products → Add Product
2. Name: "Script-Speech Creator"
3. Price: $10/month (recurring)
4. Billing interval: Monthly

**2. Pro Plan**
1. Name: "Script-Speech Pro"
2. Price: $50/month (recurring)
3. Billing interval: Monthly

**3. Agency Plan**
1. Name: "Script-Speech Agency"
2. Price: $500/month (recurring)
3. Billing interval: Monthly

### Capture Product IDs

After creating, save the IDs:
```env
# In .env.local or environment
STRIPE_PRODUCT_CREATOR=prod_test_...
STRIPE_PRODUCT_PRO=prod_test_...
STRIPE_PRODUCT_AGENCY=prod_test_...
```

Or embed in code:
```typescript
// src/lib/stripe/products.ts
export const STRIPE_PRODUCTS = {
  creator: 'price_test_creator',
  pro: 'price_test_pro',
  agency: 'price_test_agency',
};
```

---

## 4. Webhook Setup

### Create Webhook Endpoint

**Option A: Using Stripe CLI (Recommended)**

```bash
# Install Stripe CLI
# macOS:
brew install stripe/stripe-cli/stripe

# Linux:
curl https://files.stripe.com/stripe-cli/install.sh | bash

# Login
stripe login

# Forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Output:
# > Ready! Your webhook signing secret is: whsec_test_...
```

Copy the webhook secret and add to .env.local:
```env
STRIPE_WEBHOOK_SECRET=whsec_test_... # From stripe listen output
```

**Option B: Using Stripe Dashboard**

1. Developers → Webhooks
2. Add endpoint
3. URL: `https://your-domain.com/api/stripe/webhook`
4. Events to send:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Create endpoint
6. Copy signing secret to .env.local

### Test Webhook

```bash
# With Stripe CLI running, trigger test event
stripe trigger checkout.session.completed

# In dev server logs, should see:
# [Stripe Webhook] Event: checkout.session.completed
```

---

## 5. Test Mode Configuration

### Enable Test Card Success

By default, Stripe test mode works with any card starting with:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`

### Test Specific Scenarios

**Successful payment:**
```
Card: 4242 4242 4242 4242
Exp: 12/25
CVC: 123
```

**Requires authentication (3D Secure):**
```
Card: 4000 0025 0000 3155
Exp: 12/25
CVC: 123
```

**Payment declined:**
```
Card: 4000 0000 0000 0002
Exp: 12/25
CVC: 123
```

---

## 6. Test Checkout Session

### Create Test Subscription

```bash
# Using Stripe SDK in code:
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price: 'price_test_creator', // From dashboard
      quantity: 1,
    },
  ],
  mode: 'subscription',
  success_url: 'https://localhost:3000/dashboard',
  cancel_url: 'https://localhost:3000/pricing',
  metadata: {
    userId: 'user_123',
    tier: 'creator',
  },
});

// Redirect to session.url
```

### OR Via Dashboard

1. Developers → Test Data
2. Subscriptions → Create new
3. Select product and price
4. Add test customer
5. Complete with test card

---

## 7. Webhook Events

### Events We Listen For

```typescript
// In src/app/api/stripe/webhook/route.ts

case 'checkout.session.completed':
  // New subscription created
  // Action: Save to database

case 'invoice.payment_succeeded':
  // Monthly payment successful
  // Action: Reset credits, mark active

case 'invoice.payment_failed':
  // Payment failed (e.g., card declined)
  // Action: Mark past_due, send notification

case 'customer.subscription.deleted':
  // Subscription cancelled
  // Action: Mark cancelled, remove access
```

### Testing Events

```bash
# Using Stripe CLI
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted

# Check logs
stripe logs tail  # Shows incoming webhook requests
```

---

## 8. Customer Portal (Optional)

### Enable Stripe Portal

Allows customers to manage subscriptions themselves.

```bash
# Setup in Stripe Dashboard:
# 1. Settings → Billing Portal
# 2. Enable features:
#    - Update billing information
#    - Change subscription
#    - Cancel subscription
# 3. Get portal config ID
```

```typescript
// In your app:
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: 'https://your-app.com/dashboard',
});
```

---

## 9. Testing Checklist

Before going live, test:

- [ ] Checkout redirects to Stripe
- [ ] Test card payment succeeds
- [ ] `checkout.session.completed` webhook fires
- [ ] Subscription saved to database
- [ ] Credits show in dashboard
- [ ] TTS generation deducts credits
- [ ] Monthly reset works
- [ ] Cancellation marks inactive
- [ ] Failed payment marks past_due
- [ ] Portal link works (if enabled)

---

## 10. Production Setup

### When Ready for Live

1. **Get Live Keys**
   - Switch toggle from "Test" to "Live"
   - Copy live keys (start with `pk_live_` and `sk_live_`)
   - ⚠️ NEVER share live keys

2. **Update Environment**
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_live_...
   ```

3. **Update Products**
   - Stripe Dashboard might auto-create live versions
   - Or manually create matching products with live keys

4. **Create Live Webhook**
   - Stripe Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Update webhook secret in environment

5. **Deploy & Test**
   ```bash
   git push origin main
   # Vercel deploys to production
   ```

6. **Monitor**
   ```bash
   # Watch for webhook errors
   # Stripe Dashboard → Developers → Webhooks → Events
   ```

---

## 11. Troubleshooting

### Webhook Not Firing

**Problem:** Stripe events not reaching your webhook

**Solution:**
```bash
# Check webhook delivery status
# Stripe Dashboard → Developers → Webhooks → endpoint → Events

# Logs show failures?
# Common causes:
# 1. Endpoint URL wrong
# 2. Signing secret wrong (STRIPE_WEBHOOK_SECRET)
# 3. Server not accessible
# 4. Rate limits hit
```

### Test Card Not Working

**Problem:** Card declined in test mode

**Solution:**
- Use `4242 4242 4242 4242` (always succeeds in test)
- Check expiry isn't in past
- Check CVC is 3 digits
- Make sure you're in Test Mode (not Live)

### Customer Not Created

**Problem:** Subscription saved but no customer in Stripe

**Solution:**
```bash
# Check metadata in checkout
# Should include: userId, tier

# Verify Stripe API call:
stripe customers list

# Should see customer from checkout_session_completed
```

### Credits Not Deducting

**Problem:** TTS generation successful but credits not tracked

**Solution:**
```bash
# Check database subscription exists
SELECT * FROM subscriptions WHERE user_id = 'user_...';

# Check subscription active
SELECT status FROM subscriptions WHERE user_id = 'user_...';

# Manual test
# Call addCreditsUsed() function:
import { addCreditsUsed } from '@/lib/db/subscriptions';
await addCreditsUsed('user_...', 100);
```

---

## Key Files

| File | Purpose |
|------|---------|
| `.env.local` | API keys & secrets |
| `src/app/api/stripe/webhook/route.ts` | Webhook handler |
| `src/app/api/stripe/checkout/route.ts` | Checkout creation |
| `src/lib/db/subscriptions.ts` | Database operations |
| `supabase/migrations/add_subscriptions_table.sql` | Schema |

---

## Costs

### Stripe Pricing (2026)
- **Percentage:** 2.9% + $0.30 per transaction
- **Example:** $10 subscription = $10 in MRR you keep (fees deducted by Stripe)
- **Payout:** Monthly to your bank account

### Example Math
- 100 customers @ $10/month = $1,000 MRR
- Stripe fee (~3%) = $30
- You receive = $970/month

---

## Next Steps

1. ✅ Create Stripe account
2. ✅ Get test API keys
3. ✅ Create products & pricing
4. ✅ Setup webhook
5. ✅ Test full flow
6. [ ] Go live (when revenue ready)

---

**Last Updated:** Feb 23, 2026  
**Status:** Ready for production
