/**
 * Sync shortage reports from Drug Shortages Canada (DSC) API
 *
 * Runs every 15 minutes via cron to keep database current.
 *
 * Features:
 * - Gap detection: catches up if sync was down for > 24h
 * - Incremental sync: only processes new/changed reports
 * - Status updates: keeps drugs.currentStatus accurate
 * - Account rotation: handles rate limits gracefully
 *
 * Usage:
 *   yarn sync-dsc                # Run manually
 *
 * Production cron (every 15 min):
 *   0,15,30,45 * * * * cd /path/to/rxwatch && yarn sync-dsc >> /var/log/rxwatch-dsc.log 2>&1
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, eq, inArray, and, or, isNull, desc, max } from 'drizzle-orm';
import { DSCClient, type DSCReport, type DSCSearchParams } from '../lib/dsc-api';
import { drugs, reports, type NewDrug, type NewReport } from '../db/schema';
import { notifyError, notifySuccess } from '../lib/notify';

config({ path: '.env.local' });

// Constants
const BATCH_SIZE = 100; // Reports per API page
const GAP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day - trigger catchup if last sync older

// Active statuses to sync
const ACTIVE_STATUSES = [
  'active_confirmed',
  'anticipated_shortage',
  'to_be_discontinued',
];

// Stats tracking
interface SyncStats {
  newReports: number;
  updatedReports: number;
  resolvedReports: number;
  drugsUpdated: number;
  apiCalls: number;
}

// DSC API report structure (same as backfill.ts)
interface DSCReportFull {
  id: number;
  din: string | null;
  created_date: string;
  updated_date: string;
  type: { id: number; label: string };
  status: string;
  company_name: string;
  atc_number?: string;
  atc_description?: string;

  en_drug_brand_name?: string;
  fr_drug_brand_name?: string;
  en_drug_common_name?: string;
  fr_drug_common_name?: string;
  en_ingredients?: string;
  fr_ingredients?: string;
  drug_strength?: string;
  drug_dosage_form?: string;
  drug_dosage_form_fr?: string;
  drug_route?: string;
  drug_route_fr?: string;
  drug_package_quantity?: string;

  anticipated_start_date?: string;
  actual_start_date?: string;
  estimated_end_date?: string;
  actual_end_date?: string;
  shortage_reason?: { en_reason: string; fr_reason: string };

  anticipated_discontinuation_date?: string;
  discontinuation_date?: string;
  discontinuance_reason?: { en_reason: string; fr_reason: string };

  tier_3?: boolean;
  late_submission?: boolean;
  decision_reversal?: boolean;

  drug?: {
    din: string;
    drug_code: number;
    brand_name: string;
    brand_name_fr?: string;
    current_status: string;
    number_of_ais: string;
    ai_group_no?: string;
    company?: { name: string };
    drug_ingredients?: Array<{
      ingredient: { en_name: string; fr_name: string };
      strength: string;
      strength_unit: string;
    }>;
  };
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function mapReportType(apiLabel: string): 'shortage' | 'discontinuation' {
  return apiLabel === 'discontinuance' ? 'discontinuation' : 'shortage';
}

function mapReportStatus(
  apiStatus: string
): 'active_confirmed' | 'anticipated_shortage' | 'avoided_shortage' | 'resolved' | 'to_be_discontinued' | 'discontinued' | 'reversed' {
  const validStatuses = [
    'active_confirmed',
    'anticipated_shortage',
    'avoided_shortage',
    'resolved',
    'to_be_discontinued',
    'discontinued',
    'reversed',
  ];
  if (validStatuses.includes(apiStatus)) {
    return apiStatus as ReturnType<typeof mapReportStatus>;
  }
  console.warn(`  Unknown status: ${apiStatus}, defaulting to resolved`);
  return 'resolved';
}

function extractReport(apiReport: DSCReportFull): NewReport {
  const isDiscontinuation = apiReport.type.label === 'discontinuance';

  return {
    reportId: apiReport.id,
    din: apiReport.din || null,
    type: mapReportType(apiReport.type.label),
    status: mapReportStatus(apiReport.status),
    company: apiReport.company_name,

    brandName: apiReport.en_drug_brand_name || null,
    brandNameFr: apiReport.fr_drug_brand_name || null,
    commonName: apiReport.en_drug_common_name || null,
    commonNameFr: apiReport.fr_drug_common_name || null,
    ingredients: apiReport.en_ingredients || null,
    ingredientsFr: apiReport.fr_ingredients || null,
    drugStrength: apiReport.drug_strength || null,
    drugDosageForm: apiReport.drug_dosage_form || null,
    drugDosageFormFr: apiReport.drug_dosage_form_fr || null,
    drugRoute: apiReport.drug_route || null,
    drugRouteFr: apiReport.drug_route_fr || null,
    packagingSize: apiReport.drug_package_quantity || null,

    atcCode: apiReport.atc_number || null,
    atcDescription: apiReport.atc_description || null,

    reasonEn: isDiscontinuation
      ? apiReport.discontinuance_reason?.en_reason || null
      : apiReport.shortage_reason?.en_reason || null,
    reasonFr: isDiscontinuation
      ? apiReport.discontinuance_reason?.fr_reason || null
      : apiReport.shortage_reason?.fr_reason || null,

    anticipatedStartDate: parseDate(apiReport.anticipated_start_date),
    actualStartDate: parseDate(apiReport.actual_start_date),
    estimatedEndDate: parseDate(apiReport.estimated_end_date),
    actualEndDate: parseDate(apiReport.actual_end_date),

    anticipatedDiscontinuationDate: parseDate(apiReport.anticipated_discontinuation_date),
    discontinuationDate: parseDate(apiReport.discontinuation_date),

    tier3: apiReport.tier_3 ?? false,
    lateSubmission: apiReport.late_submission ?? false,
    decisionReversal: apiReport.decision_reversal ?? false,

    apiCreatedDate: parseDate(apiReport.created_date),
    apiUpdatedDate: parseDate(apiReport.updated_date),

    rawJson: apiReport as unknown as Record<string, unknown>,
  };
}

function extractDrug(apiReport: DSCReportFull): NewDrug | null {
  const din = apiReport.din || apiReport.drug?.din;
  if (!din) return null;

  const drug = apiReport.drug;
  const firstIngredient = drug?.drug_ingredients?.[0];

  return {
    din,
    drugCode: drug?.drug_code || null,
    brandName: drug?.brand_name || apiReport.en_drug_brand_name || null,
    brandNameFr: drug?.brand_name_fr || apiReport.fr_drug_brand_name || null,
    commonName: apiReport.en_drug_common_name || null,
    commonNameFr: apiReport.fr_drug_common_name || null,
    activeIngredient: firstIngredient?.ingredient.en_name || null,
    activeIngredientFr: firstIngredient?.ingredient.fr_name || null,
    strength: firstIngredient?.strength || null,
    strengthUnit: firstIngredient?.strength_unit || null,
    numberOfAis: drug?.number_of_ais ? parseInt(drug.number_of_ais) : null,
    aiGroupNo: drug?.ai_group_no || null,
    form: apiReport.drug_dosage_form || null,
    formFr: apiReport.drug_dosage_form_fr || null,
    route: apiReport.drug_route || null,
    routeFr: apiReport.drug_route_fr || null,
    atcCode: apiReport.atc_number || null,
    atcLevel3: apiReport.atc_description || null,
    company: drug?.company?.name || apiReport.company_name || null,
    marketStatus: drug?.current_status || null,
    hasReports: true,
  };
}

async function fetchAllActiveReports(client: DSCClient, stats: SyncStats): Promise<DSCReportFull[]> {
  const allReports: DSCReportFull[] = [];

  for (const status of ACTIVE_STATUSES) {
    console.log(`  Fetching ${status} reports...`);
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params: DSCSearchParams = {
        filter_status: status,
        limit: BATCH_SIZE,
        offset,
        orderby: 'updated_date',
        order: 'desc',
      };

      const response = await client.search(params);
      stats.apiCalls++;

      const reports = response.data as unknown as DSCReportFull[];
      allReports.push(...reports);

      console.log(`    ${status}: ${offset + reports.length}/${response.total}`);

      if (offset + reports.length >= response.total) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }
  }

  return allReports;
}

async function fetchReportsSince(client: DSCClient, since: Date, stats: SyncStats): Promise<DSCReportFull[]> {
  console.log(`  Fetching reports updated since ${since.toISOString()}...`);
  const allReports: DSCReportFull[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params: DSCSearchParams = {
      limit: BATCH_SIZE,
      offset,
      orderby: 'updated_date',
      order: 'desc',
    };

    const response = await client.search(params);
    stats.apiCalls++;

    const reports = response.data as unknown as DSCReportFull[];

    // Filter to reports updated after our cutoff
    const newReports = reports.filter(r => {
      const updatedDate = new Date(r.updated_date);
      return updatedDate > since;
    });

    allReports.push(...newReports);

    console.log(`    Fetched ${offset + reports.length}/${response.total}, ${newReports.length} new`);

    // Stop if we've hit reports older than our cutoff
    if (newReports.length < reports.length || offset + reports.length >= response.total) {
      hasMore = false;
    } else {
      offset += BATCH_SIZE;
    }
  }

  return allReports;
}

async function main() {
  const startTime = Date.now();
  console.log('=== DSC Sync ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  // Initialize stats
  const stats: SyncStats = {
    newReports: 0,
    updatedReports: 0,
    resolvedReports: 0,
    drugsUpdated: 0,
    apiCalls: 0,
  };

  // Connect to database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pgClient = postgres(databaseUrl);
  const db = drizzle(pgClient);

  // Initialize DSC client
  let client: DSCClient;
  try {
    client = DSCClient.fromEnv();
    console.log(`Using ${client.getAccountCount()} DSC account(s)`);
  } catch (e) {
    console.error('Failed to initialize DSC client:', e);
    process.exit(1);
  }

  try {
    // Step 1: Get last sync time from database
    console.log('\n1. Checking last sync time...');
    const lastSyncResult = await db
      .select({ maxDate: max(reports.apiUpdatedDate) })
      .from(reports);

    const lastSyncDate = lastSyncResult[0]?.maxDate;
    const now = new Date();

    if (lastSyncDate) {
      const gap = now.getTime() - lastSyncDate.getTime();
      const gapHours = Math.round(gap / (60 * 60 * 1000));
      console.log(`  Last sync: ${lastSyncDate.toISOString()} (${gapHours}h ago)`);

      if (gap > GAP_THRESHOLD_MS) {
        console.log(`  Gap > 24h, will fetch all reports since last sync`);
      }
    } else {
      console.log('  No existing reports - this appears to be a fresh database');
      console.log('  Consider running yarn backfill first for historical data');
    }

    // Step 2: Login to DSC API
    console.log('\n2. Authenticating with DSC API...');
    await client.login();
    console.log(`  Logged in as ${client.getCurrentAccount()}`);

    // Step 3: Fetch reports from API
    console.log('\n3. Fetching reports from API...');
    let apiReports: DSCReportFull[];

    if (lastSyncDate && (now.getTime() - lastSyncDate.getTime()) <= GAP_THRESHOLD_MS) {
      // Normal sync: just get active reports
      apiReports = await fetchAllActiveReports(client, stats);
    } else if (lastSyncDate) {
      // Gap recovery: get all reports updated since last sync
      apiReports = await fetchReportsSince(client, lastSyncDate, stats);
    } else {
      // Fresh database: get all active reports
      apiReports = await fetchAllActiveReports(client, stats);
    }

    console.log(`  Total reports from API: ${apiReports.length}`);

    if (apiReports.length === 0) {
      console.log('\n  No reports to process');
      await pgClient.end();
      return;
    }

    // Step 4: Get existing report IDs from database
    console.log('\n4. Comparing with database...');
    const apiReportIds = apiReports.map(r => r.id);
    const existingReports = await db
      .select({ reportId: reports.reportId, status: reports.status })
      .from(reports)
      .where(inArray(reports.reportId, apiReportIds));

    const existingMap = new Map(existingReports.map(r => [r.reportId, r.status]));
    console.log(`  Found ${existingMap.size} existing reports in database`);

    // Step 5: Process reports - insert new, update changed
    console.log('\n5. Processing reports...');
    const drugsToUpdate = new Set<string>();

    for (const apiReport of apiReports) {
      const existingStatus = existingMap.get(apiReport.id);
      const reportData = extractReport(apiReport as DSCReportFull);
      const drugData = extractDrug(apiReport as DSCReportFull);

      if (!existingStatus) {
        // New report - insert
        await db.insert(reports)
          .values(reportData)
          .onConflictDoNothing();
        stats.newReports++;

        if (drugData?.din) {
          drugsToUpdate.add(drugData.din);
        }
      } else if (existingStatus !== reportData.status) {
        // Status changed - update
        await db.update(reports)
          .set({
            ...reportData,
            updatedAt: new Date(),
          })
          .where(eq(reports.reportId, apiReport.id));
        stats.updatedReports++;

        if (drugData?.din) {
          drugsToUpdate.add(drugData.din);
        }
      }

      // Insert/update drug info if we have it
      if (drugData?.din) {
        await db.insert(drugs)
          .values(drugData)
          .onConflictDoUpdate({
            target: drugs.din,
            set: {
              // Only update fields that might be new/changed
              commonName: sql`COALESCE(EXCLUDED.common_name, ${drugs.commonName})`,
              commonNameFr: sql`COALESCE(EXCLUDED.common_name_fr, ${drugs.commonNameFr})`,
              hasReports: sql`true`,
              updatedAt: sql`NOW()`,
            },
          });
      }
    }

    console.log(`  New reports: ${stats.newReports}`);
    console.log(`  Updated reports: ${stats.updatedReports}`);

    // Step 6: Check for resolved reports
    // Reports that were active in our DB but not in API response are now resolved
    console.log('\n6. Checking for resolved reports...');

    // Get our active reports
    const ourActiveReports = await db
      .select({ reportId: reports.reportId, din: reports.din })
      .from(reports)
      .where(
        inArray(reports.status, ['active_confirmed', 'anticipated_shortage', 'to_be_discontinued'])
      );

    const apiReportIdSet = new Set(apiReportIds);
    const resolvedReportIds: number[] = [];

    for (const report of ourActiveReports) {
      if (!apiReportIdSet.has(report.reportId)) {
        resolvedReportIds.push(report.reportId);
        if (report.din) {
          drugsToUpdate.add(report.din);
        }
      }
    }

    if (resolvedReportIds.length > 0) {
      // Fetch the actual current status for these reports
      console.log(`  Found ${resolvedReportIds.length} potentially resolved reports, verifying...`);

      for (const reportId of resolvedReportIds) {
        try {
          // Get the existing report to check its type
          const existingReport = await db
            .select({ type: reports.type })
            .from(reports)
            .where(eq(reports.reportId, reportId))
            .limit(1);

          if (existingReport.length === 0) continue;

          // Fetch current status from API
          // Note: DB stores 'discontinuation', API expects 'discontinuance'
          const apiType = existingReport[0].type === 'discontinuation' ? 'discontinuance' : 'shortage';
          const apiReport = await client.getReport(reportId, apiType);
          stats.apiCalls++;

          const currentStatus = mapReportStatus((apiReport as unknown as DSCReportFull).status);

          // Update if status changed
          if (!['active_confirmed', 'anticipated_shortage', 'to_be_discontinued'].includes(currentStatus)) {
            await db.update(reports)
              .set({
                status: currentStatus,
                apiUpdatedDate: parseDate((apiReport as unknown as DSCReportFull).updated_date),
                rawJson: apiReport as unknown as Record<string, unknown>,
                updatedAt: new Date(),
              })
              .where(eq(reports.reportId, reportId));
            stats.resolvedReports++;
          }
        } catch (e) {
          console.warn(`    Failed to verify report ${reportId}:`, e);
        }
      }

      console.log(`  Resolved reports: ${stats.resolvedReports}`);
    }

    // Step 7: Update drug statuses
    if (drugsToUpdate.size > 0) {
      console.log(`\n7. Updating drug statuses for ${drugsToUpdate.size} drugs...`);

      // Update currentStatus for affected drugs
      // Use inArray for proper array parameter binding
      const dinsToUpdate = Array.from(drugsToUpdate);

      await db.execute(sql`
        UPDATE drugs d
        SET current_status = COALESCE(
          (
            SELECT
              CASE
                WHEN r.status = 'active_confirmed' THEN 'in_shortage'
                WHEN r.status = 'anticipated_shortage' THEN 'anticipated'
                WHEN r.status = 'to_be_discontinued' THEN 'to_be_discontinued'
                WHEN r.status = 'discontinued' THEN 'discontinued'
                ELSE NULL
              END
            FROM reports r
            WHERE r.din = d.din
              AND r.status IN ('active_confirmed', 'anticipated_shortage', 'to_be_discontinued', 'discontinued')
            ORDER BY
              CASE r.status
                WHEN 'active_confirmed' THEN 1
                WHEN 'anticipated_shortage' THEN 2
                WHEN 'to_be_discontinued' THEN 3
                WHEN 'discontinued' THEN 4
              END
            LIMIT 1
          ),
          'available'
        )::drug_status,
        updated_at = NOW()
        WHERE d.din IN (${sql.join(dinsToUpdate.map(din => sql`${din}`), sql`, `)})
      `);

      stats.drugsUpdated = drugsToUpdate.size;
      console.log(`  Updated ${stats.drugsUpdated} drug statuses`);
    }

    // Summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n=== DSC Sync Complete ===');
    console.log(`Duration: ${duration}s`);
    console.log(`API calls: ${stats.apiCalls}`);
    console.log(`New reports: ${stats.newReports}`);
    console.log(`Updated reports: ${stats.updatedReports}`);
    console.log(`Resolved reports: ${stats.resolvedReports}`);
    console.log(`Drugs updated: ${stats.drugsUpdated}`);

    // Notify success (only logs, no webhook for success)
    await notifySuccess('sync-dsc', {
      duration,
      apiCalls: stats.apiCalls,
      newReports: stats.newReports,
      updatedReports: stats.updatedReports,
      resolvedReports: stats.resolvedReports,
      drugsUpdated: stats.drugsUpdated,
    });

  } catch (e) {
    console.error('\nFatal error:', e);

    // Notify error (logs + webhook if configured)
    await notifyError('sync-dsc', e instanceof Error ? e : new Error(String(e)));

    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main();
