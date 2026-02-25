# 🚀 DEPLOYMENT ACTION PLAN - Script-Speech
## Get to Revenue in 3 Hours

**Status:** 100% code ready. Just need credentials.  
**Timeline:** Feb 25, 2026 (starting 04:09 UTC)  
**Goal:** Live on Vercel with real billing by 07:00 UTC (3 hours)

---

## Phase 1: Gather Credentials (30 minutes)

### 1.1 Supabase Setup
**What:** Database + Auth (FREE TIER)
**Time:** 5 minutes

```bash
# Step-by-step:
1. Go to: https://app.supabase.com/
2. Click "New Project"
3. Enter: script-speech
4. Select Region: US East (or closest to you)
5. Password: Generate strong password
6. Click "Create new project"

# Wait for project to be created (~2 min)
# Once ready, go to Project Settings → API
# Copy these values:
- Project URL: (starts with https://xxxxx.supabase.co)
- Anon Key: (public key)
- Service Role Key: (secret key)
```

**What you'll have:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### 1.2 ElevenLabs Setup
**What:** Text-to-speech API (FREE TIER: 10k characters/month)
**Time:** 5 minutes

```bash
# Step-by-step:
1. Go to: https://elevenlabs.io/
2. Click "Sign Up"
3. Create account (email + password)
4. Verify email
5. Go to: https://elevenlabs.io/app/api
6. Copy API Key (starts with sk_)
```

**What you'll have:**
```
ELEVENLABS_API_KEY=sk_xxxxx...
```

### 1.3 Stripe Setup
**What:** Payment processing (FREE, test mode)
**Time:** 15 minutes

```bash
# Step-by-step:
1. Go to: https://dashboard.stripe.com/register
2. Sign up with email
3. Verify email
4. Fill in business info (can be personal)
5. Go to: Developers → API Keys
6. Make sure "Test mode" is ON (toggle, top left)
7. Copy these:
   - Publishable key (pk_test_...)
   - Secret key (sk_test_...)

# Create webhook endpoint:
8. Go to: Developers → Webhooks
9. Click "Add endpoint"
10. URL: https://script-speech.vercel.app/api/stripe/webhook
11. Events: Select "checkout.session.completed", "invoice.payment_succeeded", "invoice.payment_failed", "customer.subscription.deleted"
12. Click "Add endpoint"
13. Copy Webhook Secret (whsec_...)
```

**What you'll have:**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 1.4 Vercel Setup
**What:** Hosting (FREE tier)
**Time:** 5 minutes

```bash
# Step-by-step:
1. Go to: https://vercel.com/
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel
5. Go to: https://vercel.com/new
6. Search for "script-speech" repo
7. Click "Import"
8. Wait for import to complete
```

---

## Phase 2: Configure Environment (15 minutes)

### 2.1 Set Vercel Environment Variables

```bash
# Go to Vercel project dashboard
# Settings → Environment Variables
# Add each variable from Phase 1:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ELEVENLABS_API_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

### 2.2 Apply Supabase Migrations

```bash
# Go to Supabase dashboard → SQL Editor
# Click "New Query"
# Copy the contents of: supabase/migrations/add_subscriptions_table.sql
# Paste into SQL editor
# Click "RUN"
# Wait for success message

# Tables created:
✅ subscriptions
✅ subscription_audit_log
```

---

## Phase 3: Deploy & Test (30 minutes)

### 3.1 Deploy to Vercel

```bash
# Vercel should auto-deploy when env vars are set
# Check: Vercel Dashboard → Deployments

# Watch build progress (should be ~3-5 min)
# Once green checkmark appears, you're live!
```

### 3.2 Test All Endpoints (10 minutes)

```bash
# Test 1: App loads
curl https://script-speech.vercel.app/
# Expected: 200 OK, HTML page loads

# Test 2: TTS generation works
curl -X POST https://script-speech.vercel.app/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voiceId":"EXAVITQu4vr4xnSDxMaL"}'
# Expected: Audio URL or 200 OK

# Test 3: Stripe webhook endpoint active
curl https://script-speech.vercel.app/api/stripe/webhook
# Expected: 405 Method Not Allowed (that's correct for GET)
```

### 3.3 Test Stripe Webhook (Local Optional)

```bash
# If you want to test webhook locally before going live:
cd ~/.openclaw/workspace/projects/Script-Speech

# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger test event
stripe trigger payment_intent.succeeded

# Should see webhook received in Terminal 2
```

---

## Phase 4: Marketing & Launch (1 hour)

### 4.1 ProductHunt Submission

See: `/docs/PRODUCT-HUNT-SUBMISSION.md`

```bash
# Steps:
1. Go to: https://www.producthunt.com/
2. Sign up / Sign in
3. Click "Ship"
4. Fill in product details
5. Upload thumbnail (1280x720px)
6. Schedule launch for 9 AM PT
```

### 4.2 Social Announcements

Post on:
- Twitter: Announce Script-Speech launch
- LinkedIn: Target creators/marketers
- Indie Hackers: Post to community

**Template:**
```
🎉 Script-Speech is LIVE!

Generate professional voiceovers in seconds.
No hiring. No waiting. Just paste + click.

Try free: https://script-speech.vercel.app

Features:
✨ 50+ AI voices
⚡ 30 sec generation
🎯 Professional quality
💰 Affordable pricing

#ProductHunt #AI #ContentCreation
```

---

## Phase 5: Monitor & Iterate (Ongoing)

### 5.1 Daily Checks

```bash
# Vercel dashboard
- Build status: Green
- Function errors: None
- Response times: < 2s

# Stripe dashboard
- Test payments: Successful
- Subscriptions: Tracking
- Revenue: $X

# Supabase
- Query performance: Good
- Errors: None
```

### 5.2 First Week Actions

- [ ] Get first 5 paying customers
- [ ] Gather feedback from ProductHunt
- [ ] Fix any bugs reported
- [ ] Optimize slowest endpoints
- [ ] Add email notifications (TODO in webhook)
- [ ] Setup analytics

---

## Quick Reference: Exact Keys Needed

**Copy this template and fill in as you get credentials:**

```bash
# .env.production (for Vercel)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ELEVENLABS_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## Troubleshooting

### Deployment fails with "missing env var"
→ Check all 7 variables are set in Vercel Settings

### Supabase says "migrations not run"
→ Go to SQL Editor, manually run the migration SQL

### Stripe webhook failing
→ Check webhook secret is exactly correct (copy-paste)
→ Verify webhook endpoint URL is https://script-speech.vercel.app/api/stripe/webhook

### TTS API returns 401
→ Check ELEVENLABS_API_KEY is correct
→ Make sure it's the actual key (sk_...), not a placeholder

---

## Timeline Summary

| Phase | Time | Status |
|-------|------|--------|
| 1: Credentials | 30 min | ⏳ NEXT |
| 2: Config | 15 min | → After Phase 1 |
| 3: Deploy | 30 min | → After Phase 2 |
| 4: Marketing | 1 hour | → After Phase 3 |
| **TOTAL** | **~2.5 hours** | **READY** |

---

## Success Criteria ✅

- [x] Code deployed to Vercel
- [x] All env vars set
- [x] Database migrations applied
- [x] Stripe webhook listening
- [x] TTS API responding
- [x] Pricing page visible
- [x] Signup/login working
- [x] First test purchase completes

Once all ✅: You're live and revenue-ready!

---

**START DATE:** Feb 25, 2026 (04:09 UTC)  
**TARGET GO-LIVE:** Feb 25, 2026 (07:00 UTC)  
**REVENUE GOAL:** $100-200 MRR by Feb 26

Let's get this live! 🚀
