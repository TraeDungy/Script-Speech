# Supabase Configuration Scripts

## Prerequisites

Get your Supabase access token:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Give it a name like "Script Speech Setup"
4. Copy the token

## Configure Email Authentication

This script automatically configures Supabase to enable magic link authentication:

```bash
# Set your access token
export SUPABASE_ACCESS_TOKEN="your-token-here"

# Run the configuration script
node scripts/configure-supabase-auth.js
```

### What it does:
- ✅ Enables email authentication provider
- ✅ Configures magic link email templates
- ✅ Sets up redirect URLs for local development
- ✅ Configures OTP expiration (1 hour)

### Manual Configuration (if script fails)

If the script doesn't work, you can configure manually:

1. **Enable Email Provider:**
   - Go to https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/auth/providers
   - Find "Email" in the list
   - Toggle it ON
   - Make sure "Enable email confirmations" is checked
   - Click "Save"

2. **Configure Email Templates:**
   - Go to https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/auth/templates
   - Customize the magic link email template if desired
   - Save changes

3. **Add Redirect URLs:**
   - Go to https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/auth/url-configuration
   - Add to "Redirect URLs":
     - `http://localhost:3001/auth/callback`
     - `http://localhost:3000/auth/callback`
   - Click "Save"

## Testing Magic Link Authentication

After configuration:

1. Start the dev server: `npm run dev`
2. Go to http://localhost:3001/login
3. Click the "Magic Link" tab
4. Enter your email address
5. Click "Send Magic Link"
6. Check your email inbox
7. Click the link in the email
8. You'll be redirected to the studio!

## Troubleshooting

### "Invalid API key" errors
- Make sure you're using an **access token** from https://supabase.com/dashboard/account/tokens
- Don't use the service role key - this script needs a personal access token

### No email received
- Check your spam folder
- Verify email provider is enabled in Supabase dashboard
- Check Supabase logs at https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/logs/auth-logs

### Redirect not working
- Make sure redirect URLs are configured in Supabase
- Check browser console for errors
- Verify NEXT_PUBLIC_SUPABASE_URL in .env.local is correct
