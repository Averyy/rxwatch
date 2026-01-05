/**
 * Test script to verify Drug Shortages Canada API responses
 * Run with: npx tsx scripts/test-dsc-api.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const DSC_API_URL = process.env.DSC_API_URL || 'https://www.drugshortagescanada.ca/api/v1';
const DSC_ACCOUNTS = JSON.parse(process.env.DSC_ACCOUNTS || '[]');

const TIMEOUT_MS = 60000; // 60 second timeout for slow API

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function login(): Promise<string> {
  const account = DSC_ACCOUNTS[0];
  if (!account) throw new Error('No DSC_ACCOUNTS configured');

  console.log(`\n🔐 Logging in as ${account.email}...`);
  const response = await fetchWithTimeout(`${DSC_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: account.email, password: account.password }),
  });

  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  const authToken = response.headers.get('auth-token');
  if (!authToken) throw new Error('No auth-token');
  console.log('✅ Login successful');
  return authToken;
}

async function apiGet(authToken: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${DSC_API_URL}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetchWithTimeout(url.toString(), { headers: { 'auth-token': authToken } });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

async function main() {
  const authToken = await login();

  // Get active shortage
  console.log('\n📋 Fetching active shortage...');
  const shortages = await apiGet(authToken, 'search', { filter_status: 'active_confirmed', limit: '1' });
  if (shortages.data?.[0]) {
    console.log('\n=== SEARCH RESULT (shortage) ===');
    console.log(JSON.stringify(shortages.data[0], null, 2));
    
    const details = await apiGet(authToken, `shortages/${shortages.data[0].id}`);
    console.log('\n=== SHORTAGE DETAILS ===');
    console.log(JSON.stringify(details, null, 2));
  }

  // Get discontinuation
  console.log('\n📋 Fetching discontinuation...');
  const discont = await apiGet(authToken, 'search', { filter_status: 'discontinued', limit: '1' });
  if (discont.data?.[0]) {
    console.log('\n=== SEARCH RESULT (discontinuation) ===');
    console.log(JSON.stringify(discont.data[0], null, 2));
    
    const details = await apiGet(authToken, `discontinuances/${discont.data[0].id}`);
    console.log('\n=== DISCONTINUANCE DETAILS ===');
    console.log(JSON.stringify(details, null, 2));
  }

  console.log('\n✅ Done');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
