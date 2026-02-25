# ⚡ PHASE 1: CREDENTIALS (30 MINUTES)
## Do This First - Then Move to Phase 2

**Status:** ⏳ STARTING NOW  
**Duration:** 30 minutes (5+5+15+5)  
**Result:** 7 credentials gathered  
**Next:** Move to Phase 2 (Deploy)

---

## 🚨 CRITICAL: DO THESE IN ORDER

Do NOT skip around. Do them in this exact sequence to minimize context switching.

---

## STEP 1: SUPABASE (5 MINUTES)

### What You're Doing
Creating a database for user subscriptions & usage tracking.

### How

```
1. Open: https://app.supabase.com/
2. Click "New Project" (green button, top right)
3. Fill in:
   - Project name: script-speech
   - Database password: Generate strong (they generate one)
   - Region: Choose closest to you (US East is fine)
4. Click "Create new project"
5. Wait ~2 minutes for setup
```

### When Ready (Project loads)

```
6. Go to: Settings → API (left sidebar)
7. Copy these THREE values:
   
   A) Project URL (says "https://xxxxx.supabase.co")
      → NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
   
   B) anon public key (JWT token starting with eyJ)
      → NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   
   C) service_role secret (JWT token, click "Reveal" if hidden)
      → SUPABASE_SERVICE_ROLE_KEY = eyJ...

8. Paste all three into CREDENTIALS-TEMPLATE.md
```

### Verify
- [ ] All 3 values pasted into template
- [ ] Each starts with correct format (https://, eyJ, eyJ)
- [ ] No spaces at edges

**Status: ✅ DONE (Move to next)**

---

## STEP 2: ELEVENLABS (5 MINUTES)

### What You're Doing
Getting TTS (text-to-speech) API credentials.

### How

```
1. Open: https://elevenlabs.io/
2. Click "Sign Up" (top right)
3. Create account:
   - Email: Your email
   - Password: Strong password
   - Accept terms
   - Click "Create account"
4. Verify email (check inbox)
5. Log back in to ElevenLabs
```

### When Logged In

```
6. Go to: Account → API (or click avatar → API)
7. Click on your API key (or "Copy" button)
8. Copy the key (starts with "sk_")
   → ELEVENLABS_API_KEY = sk_xxxxx...
9. Paste into CREDENTIALS-TEMPLATE.md
```

### Verify
- [ ] API key pasted
- [ ] Starts with "sk_"
- [ ] No spaces at edges

**Status: ✅ DONE (Move to next)**

---

## STEP 3: STRIPE (15 MINUTES)

### What You're Doing
Setting up payment processing (test mode).

### How - Part A: Account & Keys

```
1. Open: https://dashboard.stripe.com/register
2. Sign up:
   - Email: Your email
   - Password: Strong
   - Click "Create account"
3. Complete onboarding (can skip most questions)
4. Click through until you reach dashboard
5. Make sure TEST MODE is ON:
   - Look for toggle in top left
   - Should say "Test mode" (not "Live mode")
```

### When on Dashboard

```
6. Go to: Developers → API Keys (left sidebar)
7. Copy TWO keys (make sure Test mode is ON):
   
   A) Publishable key (starts with "pk_test_")
      → NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...
   
   B) Secret key (starts with "sk_test_")
      → STRIPE_SECRET_KEY = sk_test_...

8. Paste both into CREDENTIALS-TEMPLATE.md
```

### How - Part B: Webhook Endpoint

```
9. Still in Developers → Now go to: Webhooks
10. Click "+ Add endpoint" (blue button)
11. In "Endpoint URL" field, paste:
    https://script-speech.vercel.app/api/stripe/webhook
    
12. Under "Events to send", select these 4:
    - checkout.session.completed
    - invoice.payment_succeeded
    - invoice.payment_failed
    - customer.subscription.deleted
    
    (Type in the search box to find them quick)
    
13. Click "Add endpoint"
14. Your new endpoint appears - click on it
15. Scroll to "Signing secret"
16. Click "Reveal" → Copy the secret (starts with "whsec_")
    → STRIPE_WEBHOOK_SECRET = whsec_...
    
17. Paste into CREDENTIALS-TEMPLATE.md
```

### Verify
- [ ] Publishable key pasted (pk_test_...)
- [ ] Secret key pasted (sk_test_...)
- [ ] Webhook secret pasted (whsec_...)
- [ ] All three start with correct prefix
- [ ] No spaces at edges

**Status: ✅ DONE (Move to next)**

---

## STEP 4: VERCEL (5 MINUTES)

### What You're Doing
Creating hosting project for Script-Speech.

### How

```
1. Open: https://vercel.com/
2. Click "Sign Up" (top right)
3. Choose "Continue with GitHub"
4. Authorize Vercel (GitHub will ask for permission)
5. Once logged in, go to: https://vercel.com/new
6. In search box, type: script-speech
7. Your Script-Speech repo appears
8. Click "Import"
9. Vercel imports the project (wait ~30 seconds)
10. Once done, you're on the Vercel project page
```

### Verify
- [ ] Project imported successfully
- [ ] You can see "script-speech" in your projects
- [ ] No errors on import

**Status: ✅ DONE (Move to Phase 2)**

---

## 📋 ALL 7 CREDENTIALS CHECKLIST

Fill in as you go:

```
[✅] 1. NEXT_PUBLIC_SUPABASE_URL = https://...
[✅] 2. NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
[✅] 3. SUPABASE_SERVICE_ROLE_KEY = eyJ...
[✅] 4. ELEVENLABS_API_KEY = sk_...
[✅] 5. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...
[✅] 6. STRIPE_SECRET_KEY = sk_test_...
[✅] 7. STRIPE_WEBHOOK_SECRET = whsec_...
```

---

## ⏰ TIMING

```
04:09 UTC: Phase 1 START
04:14 UTC: Supabase done
04:19 UTC: ElevenLabs done
04:34 UTC: Stripe done (15 min task)
04:39 UTC: Vercel done
04:39 UTC: Phase 1 COMPLETE → Move to Phase 2
```

---

## 🚨 COMMON ISSUES

### "I can't find my API key in Supabase"
→ Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api
→ Look for "Project URL" and "API Keys" sections
→ Scroll if needed

### "Stripe test mode isn't on"
→ Check top left of Stripe dashboard
→ You should see a toggle switch
→ Make sure it says "Test mode" not "Live mode"

### "My Stripe webhook endpoint failed to create"
→ Make sure URL is EXACTLY: https://script-speech.vercel.app/api/stripe/webhook
→ Check spelling (script-speech, not script_speech)
→ Vercel project might not be deployed yet (that's okay, add it now)

### "Vercel import failed"
→ Make sure you're logged in with GitHub account that has access
→ Check you're importing TraeDungy/Script-Speech (official repo)
→ Try refreshing and re-importing

---

## ✅ SUCCESS CRITERIA

Phase 1 is complete when:

- [x] All 7 credentials gathered
- [x] All pasted into CREDENTIALS-TEMPLATE.md
- [x] Each credential verified (correct format, no spaces)
- [x] Stripe webhook endpoint created
- [x] Vercel project imported

**Time taken:** ~30 minutes  
**Next step:** Move to PHASE-2-DEPLOY.md

---

## 🚀 YOU'RE SO CLOSE

- You already built the app (the hard part)
- This is just connecting 4 external services
- 30 minutes of signup/copying keys
- Then deployment is automatic
- Then LIVE ✅

**Let's GO!** 💪

---

**When Phase 1 is complete, move to:**
`PHASE-2-DEPLOY.md`

(Not created yet, but will be auto-generated once credentials are gathered)
