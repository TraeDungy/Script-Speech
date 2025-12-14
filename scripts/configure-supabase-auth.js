#!/usr/bin/env node

/**
 * Script to configure Supabase Authentication settings
 *
 * Usage:
 *   node scripts/configure-supabase-auth.js
 *
 * Requirements:
 *   - SUPABASE_PROJECT_REF environment variable (or pass as argument)
 *   - SUPABASE_ACCESS_TOKEN environment variable (get from https://supabase.com/dashboard/account/tokens)
 */

const https = require('https');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || process.argv[2] || 'xlbjhocngfmvswjpbbfj';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ACCESS_TOKEN || ACCESS_TOKEN === 'your-supabase-service-role-key') {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  console.error('');
  console.error('To get your access token:');
  console.error('1. Go to https://supabase.com/dashboard/account/tokens');
  console.error('2. Create a new access token');
  console.error('3. Run: export SUPABASE_ACCESS_TOKEN="your-token-here"');
  console.error('4. Then run this script again');
  process.exit(1);
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function configureEmailAuth() {
  console.log('🔧 Configuring Supabase Authentication...\n');

  try {
    // Enable email provider with OTP
    console.log('1️⃣  Enabling email authentication provider...');
    await makeRequest('PATCH', '/auth/config', {
      EXTERNAL_EMAIL_ENABLED: true,
      MAILER_AUTOCONFIRM: false, // Require email confirmation
      MAILER_OTP_EXP: 3600, // OTP expires in 1 hour
      DISABLE_SIGNUP: false, // Allow signups
    });
    console.log('   ✅ Email provider enabled\n');

    // Configure email templates
    console.log('2️⃣  Configuring email templates...');
    await makeRequest('PUT', '/auth/config', {
      MAILER_SUBJECTS_CONFIRMATION: 'Confirm your Script Speech account',
      MAILER_SUBJECTS_MAGIC_LINK: 'Your Script Speech magic link',
      MAILER_SUBJECTS_INVITE: 'You\'ve been invited to Script Speech',
      MAILER_TEMPLATES_MAGIC_LINK: `
<h2>Magic Link Sign In</h2>
<p>Click the link below to sign in to Script Speech:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Script Speech</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this email, you can safely ignore it.</p>
      `.trim(),
      MAILER_TEMPLATES_CONFIRMATION: `
<h2>Confirm Your Email</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create an account with Script Speech, you can safely ignore this email.</p>
      `.trim(),
    });
    console.log('   ✅ Email templates configured\n');

    // Configure redirect URLs
    console.log('3️⃣  Configuring redirect URLs...');
    await makeRequest('PUT', '/auth/config', {
      SITE_URL: 'http://localhost:3001',
      URI_ALLOW_LIST: 'http://localhost:3001/auth/callback,http://localhost:3000/auth/callback',
    });
    console.log('   ✅ Redirect URLs configured\n');

    console.log('✨ Supabase authentication is now configured!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Go to http://localhost:3001/login');
    console.log('2. Click "Magic Link" tab');
    console.log('3. Enter your email and click "Send Magic Link"');
    console.log('4. Check your email for the sign-in link');
    console.log('');
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    console.error('');
    console.error('Manual configuration steps:');
    console.error('1. Go to https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/auth/providers');
    console.error('2. Enable "Email" provider');
    console.error('3. Make sure "Enable email confirmations" is ON');
    console.error('4. Configure email templates under Auth > Email Templates');
    process.exit(1);
  }
}

// Run the configuration
configureEmailAuth();
