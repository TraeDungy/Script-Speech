#!/usr/bin/env node

/**
 * Script to configure Supabase Authentication settings (Updated API)
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN="your-token" node scripts/configure-supabase-auth-v2.js
 */

const https = require('https');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || process.argv[2] || 'xlbjhocngfmvswjpbbfj';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN || ACCESS_TOKEN.includes('your-')) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  console.error('');
  console.error('Usage:');
  console.error('  SUPABASE_ACCESS_TOKEN="your-token" node scripts/configure-supabase-auth-v2.js');
  console.error('');
  console.error('Get your token from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: path,
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
            resolve({ success: true, data: JSON.parse(data || '{}'), status: res.statusCode });
          } catch {
            resolve({ success: true, data: {}, status: res.statusCode });
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

async function getProjectConfig() {
  try {
    const result = await makeRequest('GET', `/v1/projects/${PROJECT_REF}`);
    return result;
  } catch (error) {
    console.error('Failed to get project config:', error.message);
    return null;
  }
}

async function updateAuthConfig() {
  try {
    // Try to update auth config using the settings endpoint
    const result = await makeRequest('PATCH', `/v1/projects/${PROJECT_REF}/config/auth`, {
      EXTERNAL_EMAIL_ENABLED: true,
      MAILER_AUTOCONFIRM: false,
      DISABLE_SIGNUP: false,
      MAILER_OTP_EXP: 3600,
      SITE_URL: 'http://localhost:3001',
      URI_ALLOW_LIST: 'http://localhost:3001/auth/callback,http://localhost:3000/auth/callback',
    });
    return result;
  } catch (error) {
    console.error('Failed to update auth config:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔧 Configuring Supabase Authentication...\n');

  // Step 1: Verify project access
  console.log('1️⃣  Verifying project access...');
  const projectConfig = await getProjectConfig();

  if (projectConfig) {
    console.log('   ✅ Project access verified');
    console.log(`   📝 Project: ${projectConfig.data.name || PROJECT_REF}\n`);
  } else {
    console.log('   ⚠️  Could not verify project (may still work)\n');
  }

  // Step 2: Update auth configuration
  console.log('2️⃣  Updating authentication configuration...');
  const authConfig = await updateAuthConfig();

  if (authConfig) {
    console.log('   ✅ Authentication configured\n');
  } else {
    console.log('   ⚠️  API configuration not available\n');
  }

  // Print manual steps
  console.log('📋 Manual Configuration Steps:');
  console.log('');
  console.log('Please complete these steps in the Supabase dashboard:');
  console.log('');
  console.log('1. Enable Email Provider:');
  console.log(`   → https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers`);
  console.log('   • Find "Email" in the provider list');
  console.log('   • Toggle it ON');
  console.log('   • Enable "Confirm email"');
  console.log('   • Click Save');
  console.log('');
  console.log('2. Configure URL Settings:');
  console.log(`   → https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration`);
  console.log('   • Site URL: http://localhost:3001');
  console.log('   • Redirect URLs: http://localhost:3001/auth/callback');
  console.log('   • Click Save');
  console.log('');
  console.log('3. Test Magic Link:');
  console.log('   • Go to http://localhost:3001/login');
  console.log('   • Click "Magic Link" tab');
  console.log('   • Enter your email');
  console.log('   • Check your inbox for the magic link!');
  console.log('');
  console.log('✨ Configuration guide complete!');
}

main().catch(console.error);
