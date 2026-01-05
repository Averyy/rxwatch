/**
 * Sync drugs from Health Canada Drug Product Database (DPD)
 *
 * Three modes:
 * 1. Backfill (--backfill): Fetches ALL 57k drugs + details from API
 *    - Saves raw data to dpd/ folder in batched files (~58 files, not 57k)
 *    - Inserts to database in batches of 1000 drugs
 *    - Resumable: skips already-cached drugs on restart
 *
 * 2. From Cache (--from-cache): Imports from dpd/ folder to database
 *    - Use after backfill to re-import without hitting API
 *    - Fast: ~30 seconds vs 1-2 hours
 *
 * 3. Incremental (default): Daily sync with smart change detection
 *    - Quick HEAD request checks Content-Length (~14MB file)
 *    - If unchanged AND < 1 month since full sync: skips (instant)
 *    - If changed OR > 1 month: downloads + compares last_update_date
 *    - Typically processes 0-100 drugs when changes found
 *
 * Usage:
 *   yarn sync-dpd:backfill          # Full API fetch + cache + DB insert
 *   yarn sync-dpd:from-cache        # Import from cache only (no API calls)
 *   yarn sync-dpd                   # Daily sync with change detection
 *   yarn sync-dpd --force           # Force full sync (bypass change detection)
 *
 * Production cron (daily at 4am EST):
 *   0 9 * * * cd /path/to/rxwatch && yarn sync-dpd >> /var/log/rxwatch-dpd.log 2>&1
 *
 * Cache structure (batched - ~58 files total):
 *   dpd/
 *   ├── drug-list.json              # All drugs from /drugproduct/ (~14MB)
 *   ├── drugs-00000.json            # Drugs 0-999 with details (~2MB each)
 *   ├── drugs-01000.json            # Drugs 1000-1999
 *   ├── drugs-02000.json            # etc.
 *   └── ...
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drugs, type NewDrug } from '../db/schema';

config({ path: '.env.local' });

const DPD_API_URL = 'https://health-products.canada.ca/api/drug';
const SYNC_STATE_FILE = path.join(process.cwd(), '.dpd-sync-state.json');
const DPD_CACHE_DIR = path.join(process.cwd(), 'dpd');

// Timeouts and rate limiting
const API_TIMEOUT_MS = 60000; // 60s for API calls
const CONCURRENT_REQUESTS = 20; // Parallel requests for detail fetching
const DELAY_BETWEEN_BATCHES_MS = 100; // Small delay between batches
const DB_BATCH_SIZE = 500; // Insert to DB every N drugs

interface SyncState {
  lastSyncTimestamp: string;
  drugsCount: number;
  lastContentLength?: number;  // For quick change detection via HEAD request
  lastFullSyncTimestamp?: string;  // Force full sync if > 1 month old
}

interface APIDrug {
  drug_code: number;
  drug_identification_number: string;
  brand_name: string;
  brand_name_f?: string;
  company_name: string;
  descriptor: string;
  number_of_ais: string;
  ai_group_no: string;
  class_name: string;
  last_update_date: string;
}

interface DrugDetails {
  ingredients: Array<{ ingredient_name: string; strength: string; strength_unit: string }>;
  forms: Array<{ pharmaceutical_form_name: string }>;
  routes: Array<{ route_of_administration_name: string }>;
  therapeutics: Array<{ tc_atc_number: string; tc_atc: string }>;
  status: { status: string } | null; // Single object, not array
}

// ============================================
// Utility Functions
// ============================================

async function fetchWithTimeout(url: string, timeoutMs: number = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJSON<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (e: any) {
      if (attempt < retries) {
        const delay = attempt * 2000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Exhausted retries');
}

function loadSyncState(): SyncState | null {
  try {
    if (fs.existsSync(SYNC_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSyncState(state: SyncState): void {
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchDrugDetails(drugCode: number): Promise<DrugDetails> {
  const [ingredients, forms, routes, therapeutics, status] = await Promise.all([
    fetchJSON<DrugDetails['ingredients']>(`${DPD_API_URL}/activeingredient/?id=${drugCode}`).catch(() => []),
    fetchJSON<DrugDetails['forms']>(`${DPD_API_URL}/form/?id=${drugCode}`).catch(() => []),
    fetchJSON<DrugDetails['routes']>(`${DPD_API_URL}/route/?id=${drugCode}`).catch(() => []),
    fetchJSON<DrugDetails['therapeutics']>(`${DPD_API_URL}/therapeuticclass/?id=${drugCode}`).catch(() => []),
    fetchJSON<DrugDetails['status'] & {}>(`${DPD_API_URL}/status/?id=${drugCode}`).catch(() => null),
  ]);

  return { ingredients, forms, routes, therapeutics, status };
}

function buildDrugRecord(apiDrug: APIDrug, details: DrugDetails): NewDrug {
  const primaryIngred = details.ingredients[0];
  const form = details.forms[0];
  const route = details.routes[0];
  const ther = details.therapeutics[0];

  return {
    din: apiDrug.drug_identification_number,
    drugCode: apiDrug.drug_code,
    brandName: apiDrug.brand_name || null,
    brandNameFr: apiDrug.brand_name_f || null,
    commonName: null, // Will be populated from DSC if available
    commonNameFr: null,
    activeIngredient: primaryIngred?.ingredient_name || null,
    activeIngredientFr: null, // Would need separate FR API call
    strength: primaryIngred?.strength || null,
    strengthUnit: primaryIngred?.strength_unit || null,
    numberOfAis: parseInt(apiDrug.number_of_ais) || 1,
    aiGroupNo: apiDrug.ai_group_no || null,
    form: form?.pharmaceutical_form_name || null,
    formFr: null, // Would need separate FR API call
    route: route?.route_of_administration_name || null,
    routeFr: null, // Would need separate FR API call
    atcCode: ther?.tc_atc_number || null,
    atcLevel3: ther?.tc_atc || null, // This is actually the drug name at ATC level 5
    atcLevel5: null,
    company: apiDrug.company_name || null,
    marketStatus: details.status?.status || 'MARKETED',
    currentStatus: 'available', // Will be updated by DSC sync
    hasReports: false, // Will be updated by DSC sync
    dpdLastUpdated: apiDrug.last_update_date ? new Date(apiDrug.last_update_date) : null,
  };
}

// ============================================
// Cache Functions (batched - ~58 files instead of 57k)
// ============================================

const CACHE_BATCH_SIZE = 1000; // Drugs per cache file

function ensureCacheDir() {
  if (!fs.existsSync(DPD_CACHE_DIR)) {
    fs.mkdirSync(DPD_CACHE_DIR, { recursive: true });
  }
}

function saveDrugListCache(drugs: APIDrug[]) {
  ensureCacheDir();
  fs.writeFileSync(
    path.join(DPD_CACHE_DIR, 'drug-list.json'),
    JSON.stringify(drugs)
  );
}

function loadDrugListCache(): APIDrug[] | null {
  const cacheFile = path.join(DPD_CACHE_DIR, 'drug-list.json');
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }
  return null;
}

// Batched cache: drugs-00000.json, drugs-01000.json, etc.
function getCacheBatchFile(batchIndex: number): string {
  return path.join(DPD_CACHE_DIR, `drugs-${String(batchIndex * CACHE_BATCH_SIZE).padStart(5, '0')}.json`);
}

function saveDrugBatchCache(batchIndex: number, drugs: Array<{ din: string; apiDrug: APIDrug; details: DrugDetails }>) {
  ensureCacheDir();
  const batchFile = getCacheBatchFile(batchIndex);
  fs.writeFileSync(batchFile, JSON.stringify(drugs));
}

function loadAllCachedDrugs(): Map<string, { apiDrug: APIDrug; details: DrugDetails }> {
  const result = new Map<string, { apiDrug: APIDrug; details: DrugDetails }>();
  if (!fs.existsSync(DPD_CACHE_DIR)) return result;

  const files = fs.readdirSync(DPD_CACHE_DIR).filter(f => f.startsWith('drugs-') && f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DPD_CACHE_DIR, file), 'utf-8')) as Array<{ din: string; apiDrug: APIDrug; details: DrugDetails }>;
    for (const item of data) {
      result.set(item.din, { apiDrug: item.apiDrug, details: item.details });
    }
  }
  return result;
}

function getCachedDins(): Set<string> {
  const cached = loadAllCachedDrugs();
  return new Set(cached.keys());
}

async function insertBatchToDb(db: ReturnType<typeof drizzle>, batch: NewDrug[]) {
  await db.insert(drugs)
    .values(batch)
    .onConflictDoUpdate({
      target: drugs.din,
      set: {
        drugCode: sql`COALESCE(EXCLUDED.drug_code, ${drugs.drugCode})`,
        brandName: sql`COALESCE(EXCLUDED.brand_name, ${drugs.brandName})`,
        brandNameFr: sql`COALESCE(EXCLUDED.brand_name_fr, ${drugs.brandNameFr})`,
        activeIngredient: sql`COALESCE(EXCLUDED.active_ingredient, ${drugs.activeIngredient})`,
        activeIngredientFr: sql`COALESCE(EXCLUDED.active_ingredient_fr, ${drugs.activeIngredientFr})`,
        strength: sql`COALESCE(EXCLUDED.strength, ${drugs.strength})`,
        strengthUnit: sql`COALESCE(EXCLUDED.strength_unit, ${drugs.strengthUnit})`,
        numberOfAis: sql`COALESCE(EXCLUDED.number_of_ais, ${drugs.numberOfAis})`,
        aiGroupNo: sql`COALESCE(EXCLUDED.ai_group_no, ${drugs.aiGroupNo})`,
        form: sql`COALESCE(EXCLUDED.form, ${drugs.form})`,
        formFr: sql`COALESCE(EXCLUDED.form_fr, ${drugs.formFr})`,
        route: sql`COALESCE(EXCLUDED.route, ${drugs.route})`,
        routeFr: sql`COALESCE(EXCLUDED.route_fr, ${drugs.routeFr})`,
        atcCode: sql`COALESCE(EXCLUDED.atc_code, ${drugs.atcCode})`,
        atcLevel3: sql`COALESCE(EXCLUDED.atc_level_3, ${drugs.atcLevel3})`,
        company: sql`COALESCE(EXCLUDED.company, ${drugs.company})`,
        marketStatus: sql`EXCLUDED.market_status`,
        dpdLastUpdated: sql`EXCLUDED.dpd_last_updated`,
        updatedAt: sql`NOW()`,
      },
    });
}

// ============================================
// Backfill Mode
// ============================================

async function runBackfill(db: ReturnType<typeof drizzle>, fromCache: boolean) {
  console.log('=== DPD Backfill Mode (API) ===\n');

  if (fromCache) {
    console.log('Running from CACHE (dpd/ folder)\n');
    return runBackfillFromCache(db);
  }

  console.log('This will fetch all ~57k drugs with full details.');
  console.log('Progress saved to dpd/ folder (batched) and database incrementally.\n');

  const startTime = Date.now();

  // Step 1: Fetch or load drug list
  let apiDrugs: APIDrug[];
  const cachedList = loadDrugListCache();

  if (cachedList) {
    console.log(`Using cached drug list (${cachedList.length} drugs)`);
    apiDrugs = cachedList;
  } else {
    console.log('Fetching drug list from API (~15MB)...');
    apiDrugs = await fetchJSON<APIDrug[]>(`${DPD_API_URL}/drugproduct/`);
    saveDrugListCache(apiDrugs);
    console.log(`Fetched and cached ${apiDrugs.length} drugs`);
  }

  // Filter to valid DINs only and deduplicate (API has ~108 duplicate DINs)
  const seenDins = new Set<string>();
  const validDrugs = apiDrugs.filter(d => {
    if (!d.drug_identification_number || d.drug_identification_number.length !== 8) return false;
    if (seenDins.has(d.drug_identification_number)) return false;
    seenDins.add(d.drug_identification_number);
    return true;
  });
  console.log(`Valid unique DINs: ${validDrugs.length} (deduped from ${apiDrugs.filter(d => d.drug_identification_number?.length === 8).length})\n`);

  // Check what's already cached
  const cachedDrugs = loadAllCachedDrugs();
  const uncachedDrugs = validDrugs.filter(d => !cachedDrugs.has(d.drug_identification_number));

  console.log(`Already cached: ${cachedDrugs.size} drugs`);
  console.log(`Remaining to fetch: ${uncachedDrugs.length} drugs\n`);

  // Step 2: Fetch details in batches of CACHE_BATCH_SIZE
  // Each batch is saved to a single file AND inserted to DB
  console.log(`Fetching details (${CONCURRENT_REQUESTS} concurrent, saving batches of ${CACHE_BATCH_SIZE})...\n`);

  let totalProcessed = 0;
  let errors = 0;
  let dbInserted = 0;
  const detailStartTime = Date.now();

  // Process in CACHE_BATCH_SIZE chunks
  for (let batchStart = 0; batchStart < uncachedDrugs.length; batchStart += CACHE_BATCH_SIZE) {
    const batchDrugs = uncachedDrugs.slice(batchStart, batchStart + CACHE_BATCH_SIZE);
    const batchIndex = Math.floor((cachedDrugs.size + batchStart) / CACHE_BATCH_SIZE);

    const batchResults: Array<{ din: string; apiDrug: APIDrug; details: DrugDetails }> = [];
    const dbRecords: NewDrug[] = [];

    // Fetch this batch in parallel sub-batches
    for (let i = 0; i < batchDrugs.length; i += CONCURRENT_REQUESTS) {
      const subBatch = batchDrugs.slice(i, i + CONCURRENT_REQUESTS);

      const results = await Promise.allSettled(
        subBatch.map(async (apiDrug) => {
          const details = await fetchDrugDetails(apiDrug.drug_code);
          return { din: apiDrug.drug_identification_number, apiDrug, details };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchResults.push(result.value);
          dbRecords.push(buildDrugRecord(result.value.apiDrug, result.value.details));
        } else {
          errors++;
        }
      }

      totalProcessed += subBatch.length;

      // Progress update
      const elapsed = (Date.now() - detailStartTime) / 1000;
      const rate = totalProcessed / elapsed;
      const remaining = (uncachedDrugs.length - totalProcessed) / rate;
      const eta = Math.ceil(remaining / 60);

      process.stdout.write(
        `\r  Progress: ${totalProcessed}/${uncachedDrugs.length} (${((totalProcessed / uncachedDrugs.length) * 100).toFixed(1)}%) | ` +
        `${rate.toFixed(1)} drugs/sec | ETA: ${eta}m | DB: ${dbInserted} | Errors: ${errors}   `
      );

      // Small delay between sub-batches
      if (i + CONCURRENT_REQUESTS < batchDrugs.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // Save batch to cache file
    if (batchResults.length > 0) {
      saveDrugBatchCache(batchIndex, batchResults);
    }

    // Insert batch to database
    if (dbRecords.length > 0) {
      await insertBatchToDb(db, dbRecords);
      dbInserted += dbRecords.length;
    }
  }

  console.log('\n');

  // Step 3: Import any cached drugs that weren't in DB yet (from previous partial runs)
  console.log('Checking for cached drugs not yet in database...');
  const allCached = loadAllCachedDrugs();
  const existingDins = new Set(
    (await db.select({ din: drugs.din }).from(drugs)).map(d => d.din)
  );

  const missingFromDb = [...allCached.entries()].filter(([din]) => !existingDins.has(din));

  if (missingFromDb.length > 0) {
    console.log(`Importing ${missingFromDb.length} cached drugs to database...`);
    const missingRecords: NewDrug[] = [];

    for (const [_, cached] of missingFromDb) {
      missingRecords.push(buildDrugRecord(cached.apiDrug, cached.details));

      if (missingRecords.length >= DB_BATCH_SIZE) {
        await insertBatchToDb(db, missingRecords);
        dbInserted += missingRecords.length;
        missingRecords.length = 0;
      }
    }

    if (missingRecords.length > 0) {
      await insertBatchToDb(db, missingRecords);
      dbInserted += missingRecords.length;
    }
  }

  // Save sync state
  saveSyncState({
    lastSyncTimestamp: new Date().toISOString(),
    drugsCount: validDrugs.length,
  });

  // Get final stats
  const result = await db.execute(sql`SELECT COUNT(*) as count FROM drugs`);
  const totalDrugs = (result[0] as { count: string })?.count ?? 0;
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const cacheFiles = fs.readdirSync(DPD_CACHE_DIR).filter(f => f.startsWith('drugs-')).length;

  console.log('\n=== Backfill Complete ===');
  console.log(`Total drugs in database: ${totalDrugs}`);
  console.log(`Cache files: ${cacheFiles} (${allCached.size} drugs)`);
  console.log(`Time: ${totalTime} minutes`);
  console.log(`Errors: ${errors}`);
}

async function runBackfillFromCache(db: ReturnType<typeof drizzle>) {
  const startTime = Date.now();

  const allCached = loadAllCachedDrugs();
  const cacheFiles = fs.existsSync(DPD_CACHE_DIR)
    ? fs.readdirSync(DPD_CACHE_DIR).filter(f => f.startsWith('drugs-')).length
    : 0;

  console.log(`Found ${cacheFiles} cache files (${allCached.size} drugs)\n`);

  if (allCached.size === 0) {
    console.log('No cached data found. Run --backfill first.');
    return;
  }

  console.log('Importing cached drugs to database...\n');

  let imported = 0;
  const records: NewDrug[] = [];

  for (const [_, cached] of allCached) {
    records.push(buildDrugRecord(cached.apiDrug, cached.details));

    if (records.length >= DB_BATCH_SIZE) {
      await insertBatchToDb(db, records);
      imported += records.length;
      process.stdout.write(`\r  Imported: ${imported}/${allCached.size}`);
      records.length = 0;
    }
  }

  if (records.length > 0) {
    await insertBatchToDb(db, records);
    imported += records.length;
  }

  // Save sync state
  saveSyncState({
    lastSyncTimestamp: new Date().toISOString(),
    drugsCount: allCached.size,
  });

  const result = await db.execute(sql`SELECT COUNT(*) as count FROM drugs`);
  const totalDrugs = (result[0] as { count: string })?.count ?? 0;
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n\n=== Import from Cache Complete ===');
  console.log(`Total drugs in database: ${totalDrugs}`);
  console.log(`Time: ${totalTime}s`);
}

// ============================================
// Incremental Mode
// ============================================

async function runIncremental(db: ReturnType<typeof drizzle>, force: boolean) {
  console.log('=== DPD Incremental Sync ===\n');

  const prevState = loadSyncState();
  if (prevState) {
    console.log(`Previous sync: ${prevState.lastSyncTimestamp}`);
    console.log(`Previous count: ${prevState.drugsCount} drugs`);
    if (prevState.lastContentLength) {
      console.log(`Previous Content-Length: ${prevState.lastContentLength.toLocaleString()} bytes`);
    }
    console.log();
  }

  // Quick check: HEAD request to compare Content-Length
  const DRUG_LIST_URL = `${DPD_API_URL}/drugproduct/`;
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  // Always do HEAD request first to get Content-Length
  // Note: Must disable gzip (Accept-Encoding: identity) or server won't send Content-Length
  let currentContentLength = 0;
  console.log('Checking Content-Length via HEAD request...');
  try {
    const headResponse = await fetch(DRUG_LIST_URL, {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'identity' },
    });
    currentContentLength = parseInt(headResponse.headers.get('content-length') || '0', 10);
    console.log(`  Current Content-Length: ${currentContentLength.toLocaleString()} bytes`);
  } catch (e) {
    console.log('  HEAD request failed, will proceed with full sync');
  }

  if (!force && prevState?.lastContentLength && prevState?.lastFullSyncTimestamp && currentContentLength > 0) {
    const timeSinceFullSync = Date.now() - new Date(prevState.lastFullSyncTimestamp).getTime();
    const monthsSinceFullSync = (timeSinceFullSync / ONE_MONTH_MS).toFixed(1);

    console.log(`  Previous Content-Length: ${prevState.lastContentLength.toLocaleString()} bytes`);
    console.log(`  Time since full sync: ${monthsSinceFullSync} months`);

    if (currentContentLength === prevState.lastContentLength && timeSinceFullSync < ONE_MONTH_MS) {
      console.log('\n  Content-Length unchanged and < 1 month since full sync.');
      console.log('  Skipping sync - no changes detected.\n');

      // Update timestamp but keep same content length
      saveSyncState({
        ...prevState,
        lastSyncTimestamp: new Date().toISOString(),
      });

      console.log('=== Sync Complete (No Changes) ===');
      return;
    }

    if (currentContentLength !== prevState.lastContentLength) {
      console.log(`\n  Content-Length changed: ${prevState.lastContentLength.toLocaleString()} → ${currentContentLength.toLocaleString()}`);
    }
    if (timeSinceFullSync >= ONE_MONTH_MS) {
      console.log('\n  Monthly full sync required.');
    }
  }

  // Fetch all drugs from API
  console.log('\nFetching drug list from API (~14MB)...');
  const response = await fetchWithTimeout(DRUG_LIST_URL);
  const apiDrugs = await response.json() as APIDrug[];
  console.log(`Fetched ${apiDrugs.length} drugs\n`);

  // Get all existing drugs from DB
  console.log('Comparing with database...');
  const existingDrugs = await db.select({
    din: drugs.din,
    dpdLastUpdated: drugs.dpdLastUpdated,
  }).from(drugs);

  const existingMap = new Map<string, Date | null>();
  for (const drug of existingDrugs) {
    existingMap.set(drug.din, drug.dpdLastUpdated);
  }

  // Find new/changed drugs
  const toUpdate: APIDrug[] = [];
  for (const apiDrug of apiDrugs) {
    const din = apiDrug.drug_identification_number;
    if (!din || din.length !== 8) continue;

    const existing = existingMap.get(din);
    const apiDate = apiDrug.last_update_date;

    if (!existing) {
      // New drug
      toUpdate.push(apiDrug);
    } else if (force || (apiDate && apiDate !== existing?.toISOString().split('T')[0])) {
      // Changed drug
      toUpdate.push(apiDrug);
    }
  }

  console.log(`Found ${toUpdate.length} new/changed drugs\n`);

  if (toUpdate.length === 0) {
    console.log('No updates needed.');
    saveSyncState({
      lastSyncTimestamp: new Date().toISOString(),
      drugsCount: apiDrugs.length,
      lastContentLength: currentContentLength,
      lastFullSyncTimestamp: new Date().toISOString(),
    });
    return;
  }

  // Fetch details for changed drugs
  console.log(`Fetching details for ${toUpdate.length} drugs...`);
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < toUpdate.length; i += CONCURRENT_REQUESTS) {
    const batch = toUpdate.slice(i, i + CONCURRENT_REQUESTS);

    const results = await Promise.allSettled(
      batch.map(async (apiDrug) => {
        const details = await fetchDrugDetails(apiDrug.drug_code);
        const record = buildDrugRecord(apiDrug, details);

        await db.insert(drugs)
          .values(record)
          .onConflictDoUpdate({
            target: drugs.din,
            set: {
              drugCode: sql`EXCLUDED.drug_code`,
              brandName: sql`EXCLUDED.brand_name`,
              brandNameFr: sql`EXCLUDED.brand_name_fr`,
              activeIngredient: sql`EXCLUDED.active_ingredient`,
              activeIngredientFr: sql`EXCLUDED.active_ingredient_fr`,
              strength: sql`EXCLUDED.strength`,
              strengthUnit: sql`EXCLUDED.strength_unit`,
              numberOfAis: sql`EXCLUDED.number_of_ais`,
              aiGroupNo: sql`EXCLUDED.ai_group_no`,
              form: sql`EXCLUDED.form`,
              formFr: sql`EXCLUDED.form_fr`,
              route: sql`EXCLUDED.route`,
              routeFr: sql`EXCLUDED.route_fr`,
              atcCode: sql`EXCLUDED.atc_code`,
              atcLevel3: sql`EXCLUDED.atc_level_3`,
              company: sql`EXCLUDED.company`,
              marketStatus: sql`EXCLUDED.market_status`,
              dpdLastUpdated: sql`EXCLUDED.dpd_last_updated`,
              updatedAt: sql`NOW()`,
            },
          });

        return record;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
      }
    }

    process.stdout.write(`\r  Progress: ${processed + errors}/${toUpdate.length} (Errors: ${errors})`);

    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
  }

  console.log('\n');

  // Save sync state
  saveSyncState({
    lastSyncTimestamp: new Date().toISOString(),
    drugsCount: apiDrugs.length,
    lastContentLength: currentContentLength,
    lastFullSyncTimestamp: new Date().toISOString(),
  });

  console.log('=== Incremental Sync Complete ===');
  console.log(`Updated: ${processed} drugs`);
  console.log(`Errors: ${errors}`);
}

// ============================================
// Main
// ============================================

async function main() {
  const isBackfill = process.argv.includes('--backfill');
  const isFromCache = process.argv.includes('--from-cache');
  const isForce = process.argv.includes('--force');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    if (isBackfill || isFromCache) {
      await runBackfill(db, isFromCache);
    } else {
      await runIncremental(db, isForce);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
