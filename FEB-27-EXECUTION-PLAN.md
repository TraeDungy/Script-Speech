# February 27th Execution Plan
## Script-Speech Deployment Day - Hour-by-Hour Schedule

**Date:** Friday, February 27, 2026  
**Start Time:** 07:00 UTC  
**End Time:** 22:00 UTC (15-hour sprint)  
**Goal:** Script-Speech LIVE with revenue by end of day  

---

## 📋 Executive Summary

| Metric | Target |
|--------|--------|
| **Project** | Script-Speech (AI Text-to-Speech) |
| **Current Status** | Code: 100% ready, Credentials: Pending |
| **Time to Revenue** | 2-3 hours (once credentials obtained) |
| **Today's Goal** | LIVE deployment + ProductHunt launch |
| **Revenue Target** | $100-200 MRR by Feb 28 |

---

## 🕐 Hour-by-Hour Schedule

### **BLOCK 1: Credentials & Foundation (07:00 - 09:00)**

#### **07:00 - 08:00 | Phase 1A: Supabase Setup** ⭐ CRITICAL PATH

**Tasks:**
- [ ] Create Supabase account (if not exists)
- [ ] Create new project "script-speech-prod"
- [ ] Save 3 credentials:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`  
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Apply migrations (10 min)

**Resources Required:**
- Browser access to https://app.supabase.com
- Migration SQL file: `/projects/Script-Speech/supabase/migrations/`

**Risk Mitigation:**
- ⚠️ If Supabase account exists → Use existing project
- ⚠️ If migration fails → Run SQL manually in SQL Editor
- ✅ Backup: Local SQLite fallback available

**Success Criteria:**
- ✓ All 3 keys copied to clipboard
- ✓ Tables visible in Supabase dashboard
- ✓ Connection test passes

**Estimated Time:** 45-60 minutes

---

#### **08:00 - 09:00 | Phase 1B: Stripe Setup** ⭐ CRITICAL PATH

**Tasks:**
- [ ] Create Stripe account (if not exists)
- [ ] Switch to "Test mode" (keep in test during deployment)
- [ ] Create 3 products:
  - Creator Tier: $19/mo (500 credits)
  - Pro Tier: $49/mo (2,000 credits)
  - Agency Tier: $149/mo (10,000 credits)
- [ ] Save credentials:
  - `STRIPE_SECRET_KEY` (test)
  - `STRIPE_PUBLISHABLE_KEY` (test)
- [ ] Create webhook endpoint
- [ ] Save `STRIPE_WEBHOOK_SECRET`

**Resources Required:**
- Stripe dashboard: https://dashboard.stripe.com/test/apikeys
- Webhook endpoint: `https://script-speech.vercel.app/api/stripe/webhook`

**Risk Mitigation:**
- ⚠️ Use TEST keys first (never production for initial deploy)
- ⚠️ Webhook must be created AFTER Vercel deployment (will update later)
- ✅ Fallback: Can deploy with placeholder, update webhook later

**Success Criteria:**
- ✓ 3 pricing tiers created in Stripe
- ✓ 3 keys saved (secret, publishable, webhook)
- ✓ Webhook endpoint configured

**Estimated Time:** 45-60 minutes

---

#### **09:00 - 09:30 | Phase 1C: ElevenLabs Setup**

**Tasks:**
- [ ] Create ElevenLabs account
- [ ] Navigate to API keys section
- [ ] Save `ELEVENLABS_API_KEY`
- [ ] Note voice IDs (optional - can use defaults)

**Resources Required:**
- https://elevenlabs.io/api

**Risk Mitigation:**
- ⚠️ Free tier: 10,000 characters/month (sufficient for testing)
- ✅ Can upgrade to paid once revenue starts

**Success Criteria:**
- ✓ API key saved
- ✓ Test TTS generation works

**Estimated Time:** 15-30 minutes

---

### **BLOCK 2: Deployment (09:00 - 12:00)**

#### **09:30 - 10:30 | Phase 2A: Vercel Project Setup** ⭐ CRITICAL PATH

**Tasks:**
- [ ] Create Vercel account (if not exists)
- [ ] Import GitHub repo: `TraeDungy/Script-Speech`
- [ ] Configure build settings:
  - Framework: Next.js
  - Root Directory: `./`
  - Build Command: `npm run build`
- [ ] Do NOT deploy yet (env vars first)

**Resources Required:**
- GitHub repo access
- Vercel dashboard

**Risk Mitigation:**
- ⚠️ Ensure correct branch selected (main)
- ✅ Can re-deploy anytime if needed

**Estimated Time:** 30-45 minutes

---

#### **10:30 - 11:00 | Phase 2B: Environment Variables** ⭐ CRITICAL PATH

**Tasks:**
In Vercel dashboard → Project Settings → Environment Variables:

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...xxx
SUPABASE_SERVICE_ROLE_KEY=eyJ...xxx

# Stripe (TEST MODE)
STRIPE_SECRET_KEY=sk_test_...xxx
STRIPE_PUBLISHABLE_KEY=pk_test_...xxx
STRIPE_WEBHOOK_SECRET=whsec_...xxx

# ElevenLabs
ELEVENLABS_API_KEY=xxx

# App Config
NEXT_PUBLIC_APP_URL=https://script-speech.vercel.app
```

**Resources Required:**
- All 7 credentials from Phase 1

**Risk Mitigation:**
- ⚠️ Double-check each key (no typos)
- ⚠️ Ensure STRIPE_SECRET_KEY starts with `sk_test_`
- ✅ Can verify in Vercel after save

**Success Criteria:**
- ✓ All 7 env vars saved in Vercel
- ✓ No red validation errors

**Estimated Time:** 20-30 minutes

---

#### **11:00 - 12:00 | Phase 2C: Deploy & Test** ⭐ CRITICAL PATH

**Tasks:**
- [ ] Trigger Vercel deployment
- [ ] Wait for build (5-10 minutes)
- [ ] Verify deployment URL works
- [ ] Run 5 endpoint tests:
  - [ ] `/api/health` → 200 OK
  - [ ] `/api/tts/generate` → Returns audio
  - [ ] `/api/stripe/checkout` → Creates session
  - [ ] `/pricing` → Page loads
  - [ ] Signup → Login → Studio flow

**Resources Required:**
- Vercel deployment logs
- Browser for testing

**Risk Mitigation:**
- ⚠️ If build fails → Check logs, fix, redeploy
- ⚠️ If endpoint fails → Check env vars
- ✅ Can rollback to previous deployment

**Success Criteria:**
- ✓ Green checkmark in Vercel
- ✓ All 5 tests pass
- ✓ Signup → Studio → TTS generation works

**Estimated Time:** 60 minutes

---

### **BLOCK 3: ProductHunt Launch (12:00 - 14:00)**

#### **12:00 - 13:00 | Phase 3A: ProductHunt Preparation**

**Tasks:**
- [ ] Create ProductHunt account (if not exists)
- [ ] Prepare launch assets:
  - [ ] Tagline: "AI voiceovers in 30 seconds"
  - [ ] Description: 2-3 paragraphs about features
  - [ ] Thumbnail: 240x240 PNG
  - [ ] Gallery images: 5-10 screenshots
  - [ ] Maker comment: Personal story
- [ ] Select topics: #AI #Audio #SaaS #ContentCreation
- [ ] Schedule launch for NOW or next available slot

**Resources Required:**
- https://www.producthunt.com
- Screenshots from deployed app
- ProductHunt Maker account

**Launch Copy Template:**
```
Headline: Script-Speech - AI voiceovers in 30 seconds

Description:
Transform any text into studio-quality voiceovers instantly. 
Perfect for YouTubers, podcasters, marketers who need professional 
audio without expensive equipment or voice actors.

Features:
🎙️ 50+ AI voices (English + multilingual)
⚡ Generate in 30 seconds
💳 Pay-as-you-go or subscribe
📥 Download MP3/WAV

Built with Next.js, ElevenLabs, Stripe, Supabase
```

**Risk Mitigation:**
- ⚠️ If rejected as "not unique" → Emphasize speed + quality combo
- ⚠️ If no votes → Engage personal network
- ✅ Can re-submit if first attempt fails

**Estimated Time:** 45-60 minutes

---

#### **13:00 - 14:00 | Phase 3B: Social Launch**

**Tasks:**
- [ ] Twitter/X announcement post
- [ ] LinkedIn announcement post
- [ ] Reply to ProductHunt comments
- [ ] Share in relevant communities (Reddit r/SaaS, r/Entrepreneur, etc.)
- [ ] Email 10-20 friends/contacts asking for support

**Social Post Templates:**

**Twitter:**
```
🚀 Just launched Script-Speech on @ProductHunt!

Turn any text into professional AI voiceovers in 30 seconds.

Perfect for:
• YouTube creators
• Podcasters
• Marketers

Looking for feedback from the community! 🙏

[LINK]

#buildinpublic #ai #voiceover #bootstrapped
```

**LinkedIn:**
```
Excited to share our latest project launch!

We've been quietly building Script-Speech - an AI voiceover tool 
that transforms text into studio-quality audio in seconds.

Just went live on Product Hunt and would love your feedback.

If you're a content creator, marketer, or anyone who needs 
professional voiceover without the equipment/hiring hassle - 
check it out!

[LINK]
```

**Risk Mitigation:**
- ⚠️ Low engagement → DM specific people for feedback
-