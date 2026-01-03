/**
 * Test script for Drug Shortages Canada API
 * Run with: npx tsx scripts/test-dsc-api.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const DSC_API_URL = process.env.DSC_API_URL || 'https://www.drugshortagescanada.ca/api/v1';
const accounts = JSON.parse(process.env.DSC_ACCOUNTS || '[]');
if (!accounts.length) {
  console.error('❌ No DSC_ACCOUNTS found in .env.local');
  process.exit(1);
}
const { email: EMAIL, password: PASSWORD } = accounts[0];

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function login(): Promise<string> {
  console.log('🔐 Logging in to Drug Shortages Canada API...');
  console.log(`   Email: ${EMAIL}`);
  const startTime = Date.now();

  // Try form-urlencoded (some APIs prefer this)
  const formBody = new URLSearchParams();
  formBody.append('email', EMAIL);
  formBody.append('password', PASSWORD);

  const response = await fetchWithTimeout(`${DSC_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  const elapsed = Date.now() - startTime;
  console.log(`   Response time: ${elapsed}ms`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} - ${text}`);
  }

  // Token is in response header per official docs
  const authToken = response.headers.get('auth-token');
  console.log('   auth-token header:', authToken ? `${authToken.substring(0, 50)}...` : 'none');

  const data = await response.json();
  console.log('✅ Login successful');
  console.log('   User:', data.user?.email);

  if (!authToken) {
    throw new Error('No auth-token in response headers');
  }

  return authToken;
}

async function searchShortages(authToken: string, term: string) {
  console.log(`\n🔍 Searching for "${term}"...`);
  const startTime = Date.now();

  // Per docs: use auth-token header, params in query string
  const params = new URLSearchParams({ term, limit: '50', offset: '0' });
  const response = await fetchWithTimeout(`${DSC_API_URL}/search?${params}`, {
    headers: { 'auth-token': authToken },
  });

  const elapsed = Date.now() - startTime;
  console.log(`   Response time: ${elapsed}ms`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data;
}

async function getShortageDetails(authToken: string, id: string) {
  console.log(`\n📋 Getting shortage details for ID: ${id}...`);
  const startTime = Date.now();

  const response = await fetchWithTimeout(`${DSC_API_URL}/shortages/${id}`, {
    headers: { 'auth-token': authToken },
  });

  const elapsed = Date.now() - startTime;
  console.log(`   Response time: ${elapsed}ms`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Get shortage failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Drug Shortages Canada API Test');
  console.log('='.repeat(60));

  try {
    // Step 1: Login
    const authToken = await login();

    // Step 2: Search for a common drug
    const searchResults = await searchShortages(authToken, 'metformin');
    console.log('\n📊 Search Results Summary:');
    console.log(`   Total results: ${searchResults.data?.length || 0}`);

    if (searchResults.data?.length > 0) {
      console.log('\n   First result structure:');
      console.log(JSON.stringify(searchResults.data[0], null, 2));

      // Step 3: Get details for first shortage
      const firstResult = searchResults.data[0];
      if (firstResult.id) {
        const details = await getShortageDetails(authToken, firstResult.id);
        console.log('\n📋 Shortage Details:');
        console.log(JSON.stringify(details, null, 2));
      }
    }

    // Step 4: Try a different search to see more fields
    console.log('\n' + '='.repeat(60));
    const searchResults2 = await searchShortages(authToken, 'ozempic');
    console.log('📊 Ozempic Search Results:');
    console.log(`   Total results: ${searchResults2.data?.length || 0}`);
    if (searchResults2.data?.length > 0) {
      console.log('\n   First result:');
      console.log(JSON.stringify(searchResults2.data[0], null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ API Test Complete');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
