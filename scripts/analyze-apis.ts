/**
 * Analyze both APIs to document field mappings
 * Run with: npx tsx scripts/analyze-apis.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const DSC_API_URL = process.env.DSC_API_URL || 'https://www.drugshortagescanada.ca/api/v1';
const DPD_API_URL = process.env.DPD_API_URL || 'https://health-products.canada.ca/api/drug';
const DSC_ACCOUNTS = JSON.parse(process.env.DSC_ACCOUNTS || '[]');

// ============================================
// Drug Shortages Canada API
// ============================================

async function dscLogin(): Promise<string> {
  const account = DSC_ACCOUNTS[0];
  if (!account) throw new Error('No DSC_ACCOUNTS configured');

  const response = await fetch(`${DSC_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: account.email, password: account.password }),
  });

  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  const authToken = response.headers.get('auth-token');
  if (!authToken) throw new Error('No auth-token');
  return authToken;
}

async function dscGet(authToken: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${DSC_API_URL}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), { headers: { 'auth-token': authToken } });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

// ============================================
// Health Canada DPD API
// ============================================

async function dpdGet(endpoint: string) {
  const response = await fetch(`${DPD_API_URL}/${endpoint}`);
  if (!response.ok) throw new Error(`DPD ${endpoint} failed: ${response.status}`);
  return response.json();
}

// ============================================
// Field Analysis
// ============================================

function extractFields(obj: unknown, prefix = ''): string[] {
  const fields: string[] = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      fields.push(`${path}: ${typeof value} = ${JSON.stringify(value)?.slice(0, 80)}`);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        fields.push(...extractFields(value, path));
      }
      if (Array.isArray(value) && value.length > 0) {
        fields.push(...extractFields(value[0], `${path}[0]`));
      }
    }
  }
  return fields;
}

async function main() {
  console.log('='.repeat(80));
  console.log('API FIELD ANALYSIS');
  console.log('='.repeat(80));

  // ============================================
  // DSC API Analysis
  // ============================================
  console.log('\n\n' + '='.repeat(80));
  console.log('DRUG SHORTAGES CANADA API');
  console.log('='.repeat(80));

  const authToken = await dscLogin();
  console.log('✅ Logged in to DSC API\n');

  // Get a shortage
  console.log('\n--- SHORTAGE SEARCH RESULT (filter_status=active_confirmed) ---');
  const shortages = await dscGet(authToken, 'search', { filter_status: 'active_confirmed', limit: '1' });
  if (shortages.data?.[0]) {
    console.log('Fields in search result:');
    extractFields(shortages.data[0]).forEach(f => console.log(`  ${f}`));

    console.log('\n--- SHORTAGE DETAILS (GET /shortages/{id}) ---');
    const details = await dscGet(authToken, `shortages/${shortages.data[0].id}`);
    console.log('Fields in shortage details:');
    extractFields(details).forEach(f => console.log(`  ${f}`));
  }

  // Get a discontinuation
  console.log('\n--- DISCONTINUATION SEARCH RESULT (filter_status=discontinued) ---');
  const discont = await dscGet(authToken, 'search', { filter_status: 'discontinued', limit: '1' });
  if (discont.data?.[0]) {
    console.log('Fields in search result:');
    extractFields(discont.data[0]).forEach(f => console.log(`  ${f}`));

    console.log('\n--- DISCONTINUATION DETAILS (GET /discontinuances/{id}) ---');
    const details = await dscGet(authToken, `discontinuances/${discont.data[0].id}`);
    console.log('Fields in discontinuation details:');
    extractFields(details).forEach(f => console.log(`  ${f}`));
  }

  // ============================================
  // DPD API Analysis
  // ============================================
  console.log('\n\n' + '='.repeat(80));
  console.log('HEALTH CANADA DPD API');
  console.log('='.repeat(80));

  // Use a known DIN from the shortage data
  const din = shortages.data?.[0]?.din || '02229519';
  console.log(`\nUsing DIN: ${din}`);

  console.log('\n--- DRUG PRODUCT (GET /drugproduct/?din=X) ---');
  const drugProduct = await dpdGet(`drugproduct/?din=${din}`);
  if (drugProduct[0]) {
    const drugCode = drugProduct[0].drug_code;
    console.log('Fields:');
    extractFields(drugProduct[0]).forEach(f => console.log(`  ${f}`));

    console.log(`\n--- ACTIVE INGREDIENT (GET /activeingredient/?id=${drugCode}) ---`);
    const ingredients = await dpdGet(`activeingredient/?id=${drugCode}`);
    if (ingredients[0]) {
      console.log('Fields:');
      extractFields(ingredients[0]).forEach(f => console.log(`  ${f}`));
    }

    console.log(`\n--- THERAPEUTIC CLASS (GET /therapeuticclass/?id=${drugCode}) ---`);
    const therapeutic = await dpdGet(`therapeuticclass/?id=${drugCode}`);
    if (therapeutic[0]) {
      console.log('Fields:');
      extractFields(therapeutic[0]).forEach(f => console.log(`  ${f}`));
    }

    console.log(`\n--- FORM (GET /form/?id=${drugCode}) ---`);
    const form = await dpdGet(`form/?id=${drugCode}`);
    if (form[0]) {
      console.log('Fields:');
      extractFields(form[0]).forEach(f => console.log(`  ${f}`));
    }

    console.log(`\n--- ROUTE (GET /route/?id=${drugCode}) ---`);
    const route = await dpdGet(`route/?id=${drugCode}`);
    if (route[0]) {
      console.log('Fields:');
      extractFields(route[0]).forEach(f => console.log(`  ${f}`));
    }

    console.log(`\n--- STATUS (GET /status/?id=${drugCode}) ---`);
    const status = await dpdGet(`status/?id=${drugCode}`);
    if (status[0]) {
      console.log('Fields:');
      extractFields(status[0]).forEach(f => console.log(`  ${f}`));
    }

    console.log(`\n--- COMPANY (GET /company/?id=${drugCode}) ---`);
    const company = await dpdGet(`company/?id=${drugCode}`);
    if (company[0]) {
      console.log('Fields:');
      extractFields(company[0]).forEach(f => console.log(`  ${f}`));
    }
  }

  // ============================================
  // Summary: When to use each API
  // ============================================
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY: API USAGE');
  console.log('='.repeat(80));

  console.log(`
DRUG SHORTAGES CANADA API (DSC):
================================
Use for:
- Shortage/discontinuation reports (status, dates, reasons)
- Drug info embedded in reports (brand name, ingredients, forms, routes, ATC)
- Bilingual content (en/fr names and reasons)
- Company that REPORTED the shortage

When to call:
- Initial backfill of all reports
- Every 15 min polling for updates
- Looking up shortage history for a DIN

HEALTH CANADA DPD API:
======================
Use for:
- Finding ALTERNATIVE drugs (same ingredient, different manufacturer)
- Getting market status (MARKETED, APPROVED, CANCELLED)
- Looking up drugs that have NEVER been in shortage (not in DSC)
- Getting drug_code for related queries

When to call:
- User searches for a drug not in our shortage database
- Finding alternatives for a drug in shortage
- Enriching drug catalog with market status

KEY INSIGHT:
============
The DSC API returns comprehensive nested drug data with each report.
We DON'T need to call DPD for drug info on items already in our database.
DPD is primarily for finding ALTERNATIVES and checking market status.
`);

  console.log('\n✅ Analysis complete');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
