# Supabase Migration Quick Start

**Purpose:** Apply subscriptions table schema to your Supabase database  
**Time:** 2-3 minutes  
**Status:** Ready to execute

---

## Option 1: Supabase Dashboard (Easiest)

### Step 1: Open Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your Script-Speech project
3. Click "SQL Editor" in the left sidebar

### Step 2: Create New Query
1. Click "New Query"
2. Name it: "Add subscriptions table"

### Step 3: Paste Migration
1. Open this file: `supabase/migrations/add_subscriptions_table.sql`
2. Copy all contents
3. Paste into the SQL Editor query box

### Step 4: Execute
1. Click "Run" (or Ctrl+Enter)
2. Should see: "Commands completed successfully"

### Step 5: Verify
```sql
-- Run this to verify tables were created:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscriptions', 'subscription_transactions')
ORDER BY table_name;

-- Should return:
-- subscriptions
-- subscription_transactions
```

---

## Option 2: Supabase CLI (If Installed)

```bash
# Login if not already
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Apply migrations
supabase migration up

# Verify
supabase db pull  # Shows current schema
```

---

## Option 3: PostgreSQL Client (psql)

```bash
# Get connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

# Connect
psql "postgresql://[user]:[password]@[host]:[port]/[database]"

# Paste migration contents
# (all 89 lines from add_subscriptions_table.sql)

# Type: \q to quit
```

---

## Verification Checklist

After applying migration, verify:

```sql
-- 1. Check tables exist
\dt subscriptions
-- Should show: public | subscriptions | table | (user)

\dt subscription_transactions
-- Should show: public | subscription_transactions | table | (user)

-- 2. Check subscriptions columns
\d subscriptions
-- Should show: id, user_id, stripe_subscription_id, tier, status, etc.

-- 3. Check RLS is enabled
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'subscriptions';

-- 4. Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
-- Should show 2 policies

-- 5. Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'subscriptions';
-- Should show: idx_subscriptions_user_id, idx_subscriptions_stripe_*, etc.
```

---

## Troubleshooting

### Error: "relation 'subscriptions' already exists"

This is OK - means the table was already created. Just skip and continue.

**If you want to recreate:**
```sql
-- Drop and recreate
DROP TABLE IF EXISTS public.subscription_transactions;
DROP TABLE IF EXISTS public.subscriptions;
DROP FUNCTION IF EXISTS public.update_subscriptions_updated_at();

-- Then paste migration contents again
```

### Error: "column 'tier' does not exist"

Means migration didn't apply fully. Try again:
1. Check for error messages in full response
2. Copy-paste the ENTIRE migration file (all 89 lines)
3. Run again

### Error: "permission denied for schema 'public'"

This means you need to use the service role key (not anon key).

**Solution:**
1. In Supabase Dashboard, go to Settings → API
2. Use the **Service Role Key** for connections (not Anon Key)
3. Retry migration

---

## After Migration: Next Steps

Once tables are created:

1. ✅ Verify in dashboard (Tables section should show both tables)
2. ✅ Test connection from app (npm run dev)
3. ✅ Follow LOCAL-TESTING-GUIDE.md (Step 1: Database Setup)
4. ✅ Create test user and subscription
5. ✅ Verify webhook writes to database

---

## Environment Setup

Make sure .env.local has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

All from: Supabase Dashboard → Settings → API

---

## Expected Results

After successful migration:

✅ Two new tables in "Tables" view:
   - `public.subscriptions`
   - `public.subscription_transactions`

✅ RLS policies enabled (visible in Security tab)

✅ Indexes created (performance optimized)

✅ Triggers configured (auto-update timestamps)

✅ Foreign keys set up (data integrity)

---

## Time to Complete

- Dashboard method: ~2 minutes
- CLI method: ~3 minutes
- psql method: ~5 minutes

**Recommended:** Use Dashboard (easiest, no tools needed)

---

**Status:** Ready to apply  
**Priority:** High (required before testing)  
**Next Step:** Execute Option 1 above
