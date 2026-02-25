# 🔐 CREDENTIALS TEMPLATE
## Copy & Fill In As You Gather Each Key

---

## PHASE 1: GATHER THESE 7 CREDENTIALS

### Credential 1: SUPABASE_URL
**Where:** Supabase → Project Settings → API  
**Value Format:** `https://xxxxx.supabase.co`  
**Status:** ⏳ WAITING

```
NEXT_PUBLIC_SUPABASE_URL=https://
```

---

### Credential 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
**Where:** Supabase → Project Settings → API  
**Value Format:** `eyJ0eXAiOiJKV1QiL...` (JWT token)  
**Status:** ⏳ WAITING

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

### Credential 3: SUPABASE_SERVICE_ROLE_KEY
**Where:** Supabase → Project Settings → API (Secret)  
**Value Format:** `eyJ0eXAiOiJKV1QiL...` (JWT token)  
**Status:** ⏳ WAITING

```
SUPABASE_SERVICE_ROLE_KEY=
```

---

### Credential 4: ELEVENLABS_API_KEY
**Where:** ElevenLabs → Account → API  
**Value Format:** `sk_xxxxx...` (starts with "sk_")  
**Status:** ⏳ WAITING

```
ELEVENLABS_API_KEY=sk_
```

---

### Credential 5: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
**Where:** Stripe → Developers → API Keys (Test mode ON)  
**Value Format:** `pk_test_xxxxx...` (starts with "pk_test_")  
**Status:** ⏳ WAITING

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_
```

---

### Credential 6: STRIPE_SECRET_KEY
**Where:** Stripe → Developers → API Keys (Test mode ON)  
**Value Format:** `sk_test_xxxxx...` (starts with "sk_test_")  
**Status:** ⏳ WAITING

```
STRIPE_SECRET_KEY=sk_test_
```

---

### Credential 7: STRIPE_WEBHOOK_SECRET
**Where:** Stripe → Developers → Webhooks → Created Endpoint  
**Value Format:** `whsec_xxxxx...` (starts with "whsec_")  
**Status:** ⏳ WAITING

```
STRIPE_WEBHOOK_SECRET=whsec_
```

---

## COMPLETED CHECKLIST

```
✅ = Done & Verified
⏳ = In Progress
❌ = Error (check format)
```

| # | Credential | From | Status | Value |
|---|------------|------|--------|-------|
| 1 | SUPABASE_URL | Supabase | ⏳ | `https://...` |
| 2 | SUPABASE_ANON_KEY | Supabase | ⏳ | `eyJ...` |
| 3 | SUPABASE_SERVICE_KEY | Supabase | ⏳ | `eyJ...` |
| 4 | ELEVENLABS_API_KEY | ElevenLabs | ⏳ | `sk_...` |
| 5 | STRIPE_PUBLISHABLE_KEY | Stripe | ⏳ | `pk_test_...` |
| 6 | STRIPE_SECRET_KEY | Stripe | ⏳ | `sk_test_...` |
| 7 | STRIPE_WEBHOOK_SECRET | Stripe | ⏳ | `whsec_...` |

---

## MASTER ENV TEMPLATE (COPY-PASTE)

Once you have all 7 credentials, use this template to fill in Vercel's Environment Variables:

```bash
# Paste into Vercel Dashboard → Settings → Environment Variables

NEXT_PUBLIC_SUPABASE_URL=https://
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ
SUPABASE_SERVICE_ROLE_KEY=eyJ
ELEVENLABS_API_KEY=sk_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_
STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
```

---

## VALIDATION CHECKLIST

After gathering, verify each credential:

- [ ] All 7 credentials present (none blank)
- [ ] Supabase keys start with: `https://`, `eyJ...`, `eyJ...`
- [ ] ElevenLabs key starts with: `sk_`
- [ ] Stripe keys start with: `pk_test_`, `sk_test_`, `whsec_`
- [ ] No spaces at start/end of any value
- [ ] No quotes around values (just paste raw)
- [ ] All keys are from TEST/DEVELOPMENT (not production)

---

## COMMON MISTAKES (AVOID!)

❌ **Including quotes:**
```
STRIPE_SECRET_KEY="sk_test_xxxxx"  ← WRONG
```

✅ **Just the value:**
```
STRIPE_SECRET_KEY=sk_test_xxxxx  ← CORRECT
```

---

❌ **Wrong Stripe mode:**
```
Copied from Live mode instead of Test mode
```

✅ **Right way:**
```
Check toggle says "Test mode" before copying keys
```

---

❌ **Incomplete values:**
```
STRIPE_WEBHOOK_SECRET=whsec_  ← Cut off mid-copy
```

✅ **Complete value:**
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## NEXT STEPS

1. **Create accounts** at each service (5 min each)
2. **Find credentials** in each dashboard
3. **Fill in this template**
4. **Paste into Vercel** environment variables
5. **Trigger deployment** in Vercel
6. **Done!**

---

## SUPPORT

If you can't find a credential:

**Supabase Missing?**
- Go to: https://app.supabase.com/project/_/settings/api
- Look for: "Project URL" and "API Keys"

**ElevenLabs Missing?**
- Go to: https://elevenlabs.io/app/api
- Click on your profile → "API Key"

**Stripe Missing?**
- Go to: https://dashboard.stripe.com/apikeys
- Make sure "Test mode" toggle is ON
- Look for "Publishable key" and "Secret key"

**Vercel Project Missing?**
- Go to: https://vercel.com/new
- Search for "script-speech"
- Click "Import"

---

**UPDATE THIS FILE as you gather each credential.**

**Timeline: 30 minutes to gather all 7 keys.**

**Target: All done by 04:39 UTC**
