#!/usr/bin/env node

/**
 * Fix Missing Database Tables Script
 *
 * This script creates the missing database tables needed for the realtime voice control:
 * - users (with mock preview user)
 * - realtime_sessions
 * - realtime_transcript_turns
 * - audit_log
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN="your_token" node scripts/fix-missing-tables.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_PROJECT_REF = 'xlbjhocngfmvswjpbbfj';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  console.error('');
  console.error('Get your access token from:');
  console.error('https://supabase.com/dashboard/account/tokens');
  console.error('');
  console.error('Then run:');
  console.error('SUPABASE_ACCESS_TOKEN="your_token" node scripts/fix-missing-tables.js');
  process.exit(1);
}

async function executeSql(sql) {
  const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`;

  console.log('📤 Executing SQL query...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log('🔧 Fixing Missing Database Tables for Script-Speech');
  console.log('');

  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'fix-missing-tables.sql');
  console.log(`📖 Reading SQL from: ${sqlPath}`);

  let sql;
  try {
    sql = fs.readFileSync(sqlPath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading SQL file: ${error.message}`);
    process.exit(1);
  }

  // Execute the SQL
  try {
    const result = await executeSql(sql);
    console.log('✅ SQL executed successfully!');
    console.log('');
    console.log('📋 Tables created:');
    console.log('   - users (with mock preview user)');
    console.log('   - realtime_sessions');
    console.log('   - realtime_transcript_turns');
    console.log('   - audit_log');
    console.log('');
    console.log('✨ Database is now ready for voice control!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your dev server if it\'s running');
    console.log('2. Open http://localhost:3001/studio');
    console.log('3. Click the microphone button in the Voice Control panel');
    console.log('4. Talk about your story and watch elements populate the canvas!');
  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    console.error('');
    console.error('You can also run the SQL manually:');
    console.error('1. Go to https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/sql');
    console.error('2. Copy the contents of fix-missing-tables.sql');
    console.error('3. Paste and run in the SQL Editor');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
