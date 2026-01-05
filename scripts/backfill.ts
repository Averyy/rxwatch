/**
 * Backfill database from historical JSON files
 *
 * Imports all reports from history/ folder into the database,
 * extracting drug info to populate both reports and drugs tables.
 *
 * Usage: DATABASE_URL=postgres://... npx tsx scripts/backfill.ts
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drugs, reports, type NewDrug, type NewReport } from '../db/schema';

config({ path: '.env.local' });

const HISTORY_DIR = path.join(process.cwd(), 'history');
const BATCH_SIZE = 500; // Insert in batches for performance

// DSC API report structure
interface DSCReport {
  id: number;
  din: string | null;
  created_date: string;
  updated_date: string;
  type: { id: number; label: string };
  status: string;
  company_name: string;
  atc_number?: string;
  atc_description?: string;

  // Drug info (denormalized in report)
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

  // Shortage-specific fields
  anticipated_start_date?: string;
  actual_start_date?: string;
  estimated_end_date?: string;
  actual_end_date?: string;
  shortage_reason?: { en_reason: string; fr_reason: string };

  // Discontinuation-specific fields
  anticipated_discontinuation_date?: string;
  discontinuation_date?: string;
  discontinuance_reason?: { en_reason: string; fr_reason: string };

  // Metadata
  tier_3?: boolean;
  late_submission?: boolean;
  decision_reversal?: boolean;

  // Nested drug object (for extracting drug catalog info)
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
      ingredient: {
        en_name: string;
        fr_name: string;
      };
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
  // API uses "discontinuance", we store "discontinuation"
  return apiLabel === 'discontinuance' ? 'discontinuation' : 'shortage';
}

function mapReportStatus(
  apiStatus: string
): 'active_confirmed' | 'anticipated_shortage' | 'avoided_shortage' | 'resolved' | 'to_be_discontinued' | 'discontinued' | 'reversed' {
  // API statuses match our enum exactly
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
  // Fallback for any unexpected status
  console.warn(`Unknown status: ${apiStatus}, defaulting to resolved`);
  return 'resolved';
}

function extractReport(apiReport: DSCReport): NewReport {
  const isDiscontinuation = apiReport.type.label === 'discontinuance';

  return {
    reportId: apiReport.id,
    din: apiReport.din || null,
    type: mapReportType(apiReport.type.label),
    status: mapReportStatus(apiReport.status),
    company: apiReport.company_name,

    // Drug info at time of report
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

    // ATC classification
    atcCode: apiReport.atc_number || null,
    atcDescription: apiReport.atc_description || null,

    // Reason (from shortage_reason or discontinuance_reason)
    reasonEn: isDiscontinuation
      ? apiReport.discontinuance_reason?.en_reason || null
      : apiReport.shortage_reason?.en_reason || null,
    reasonFr: isDiscontinuation
      ? apiReport.discontinuance_reason?.fr_reason || null
      : apiReport.shortage_reason?.fr_reason || null,

    // Shortage dates
    anticipatedStartDate: parseDate(apiReport.anticipated_start_date),
    actualStartDate: parseDate(apiReport.actual_start_date),
    estimatedEndDate: parseDate(apiReport.estimated_end_date),
    actualEndDate: parseDate(apiReport.actual_end_date),

    // Discontinuation dates
    anticipatedDiscontinuationDate: parseDate(apiReport.anticipated_discontinuation_date),
    discontinuationDate: parseDate(apiReport.discontinuation_date),

    // Metadata
    tier3: apiReport.tier_3 ?? false,
    lateSubmission: apiReport.late_submission ?? false,
    decisionReversal: apiReport.decision_reversal ?? false,

    // API timestamps
    apiCreatedDate: parseDate(apiReport.created_date),
    apiUpdatedDate: parseDate(apiReport.updated_date),

    // Full raw JSON for future field extraction
    rawJson: apiReport as unknown as Record<string, unknown>,
  };
}

function extractDrug(apiReport: DSCReport): NewDrug | null {
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
    // currentStatus will be computed after all reports are inserted
  };
}

async function main() {
  console.log('=== Drug Shortages Database Backfill ===\n');

  // Connect to database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  // Get all history files
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error('No JSON files found in history/ folder');
    process.exit(1);
  }

  console.log(`Found ${files.length} history files\n`);

  // Track unique drugs and reports
  const drugsMap = new Map<string, NewDrug>(); // DIN -> drug
  const allReports: NewReport[] = [];

  // Process all files
  for (const file of files) {
    const filePath = path.join(HISTORY_DIR, file);
    const data: DSCReport[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`Processing ${file}: ${data.length} reports`);

    for (const apiReport of data) {
      // Extract report
      const report = extractReport(apiReport);
      allReports.push(report);

      // Extract drug (will be deduplicated by DIN)
      const drug = extractDrug(apiReport);
      if (drug && drug.din) {
        // Keep the most recent drug info (files are sorted chronologically)
        drugsMap.set(drug.din, drug);
      }
    }
  }

  console.log(`\nTotal reports: ${allReports.length}`);
  console.log(`Unique drugs: ${drugsMap.size}\n`);

  // Insert drugs first
  console.log('Inserting drugs...');
  const drugsList = Array.from(drugsMap.values());
  let insertedDrugs = 0;

  for (let i = 0; i < drugsList.length; i += BATCH_SIZE) {
    const batch = drugsList.slice(i, i + BATCH_SIZE);
    await db.insert(drugs)
      .values(batch)
      .onConflictDoUpdate({
        target: drugs.din,
        set: {
          drugCode: sql`EXCLUDED.drug_code`,
          brandName: sql`EXCLUDED.brand_name`,
          brandNameFr: sql`EXCLUDED.brand_name_fr`,
          commonName: sql`EXCLUDED.common_name`,
          commonNameFr: sql`EXCLUDED.common_name_fr`,
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
          hasReports: sql`EXCLUDED.has_reports`,
          updatedAt: sql`NOW()`,
        },
      });
    insertedDrugs += batch.length;
    process.stdout.write(`\r  Drugs: ${insertedDrugs}/${drugsList.length}`);
  }
  console.log('\n');

  // Insert reports
  console.log('Inserting reports...');
  let insertedReports = 0;

  for (let i = 0; i < allReports.length; i += BATCH_SIZE) {
    const batch = allReports.slice(i, i + BATCH_SIZE);
    await db.insert(reports)
      .values(batch)
      .onConflictDoUpdate({
        target: reports.reportId,
        set: {
          din: sql`EXCLUDED.din`,
          type: sql`EXCLUDED.type`,
          status: sql`EXCLUDED.status`,
          company: sql`EXCLUDED.company`,
          brandName: sql`EXCLUDED.brand_name`,
          brandNameFr: sql`EXCLUDED.brand_name_fr`,
          commonName: sql`EXCLUDED.common_name`,
          commonNameFr: sql`EXCLUDED.common_name_fr`,
          ingredients: sql`EXCLUDED.ingredients`,
          ingredientsFr: sql`EXCLUDED.ingredients_fr`,
          drugStrength: sql`EXCLUDED.drug_strength`,
          drugDosageForm: sql`EXCLUDED.drug_dosage_form`,
          drugDosageFormFr: sql`EXCLUDED.drug_dosage_form_fr`,
          drugRoute: sql`EXCLUDED.drug_route`,
          drugRouteFr: sql`EXCLUDED.drug_route_fr`,
          packagingSize: sql`EXCLUDED.packaging_size`,
          atcCode: sql`EXCLUDED.atc_code`,
          atcDescription: sql`EXCLUDED.atc_description`,
          reasonEn: sql`EXCLUDED.reason_en`,
          reasonFr: sql`EXCLUDED.reason_fr`,
          anticipatedStartDate: sql`EXCLUDED.anticipated_start_date`,
          actualStartDate: sql`EXCLUDED.actual_start_date`,
          estimatedEndDate: sql`EXCLUDED.estimated_end_date`,
          actualEndDate: sql`EXCLUDED.actual_end_date`,
          anticipatedDiscontinuationDate: sql`EXCLUDED.anticipated_discontinuation_date`,
          discontinuationDate: sql`EXCLUDED.discontinuation_date`,
          tier3: sql`EXCLUDED.tier_3`,
          lateSubmission: sql`EXCLUDED.late_submission`,
          decisionReversal: sql`EXCLUDED.decision_reversal`,
          apiCreatedDate: sql`EXCLUDED.api_created_date`,
          apiUpdatedDate: sql`EXCLUDED.api_updated_date`,
          rawJson: sql`EXCLUDED.raw_json`,
          updatedAt: sql`NOW()`,
        },
      });
    insertedReports += batch.length;
    process.stdout.write(`\r  Reports: ${insertedReports}/${allReports.length}`);
  }
  console.log('\n');

  // Update drug currentStatus based on active reports
  console.log('Updating drug status...');

  // Status priority: in_shortage > anticipated > to_be_discontinued > discontinued > available
  // We'll compute this with a SQL query
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
    )::drug_status
  `);

  // Get final stats
  const drugsResult = await db.execute(sql`SELECT COUNT(*) as count FROM drugs`);
  const reportsResult = await db.execute(sql`SELECT COUNT(*) as count FROM reports`);
  const activeResult = await db.execute(sql`SELECT COUNT(*) as count FROM drugs WHERE current_status != 'available'`);

  const totalDrugs = (drugsResult[0] as { count: string })?.count ?? 0;
  const totalReports = (reportsResult[0] as { count: string })?.count ?? 0;
  const activeDrugs = (activeResult[0] as { count: string })?.count ?? 0;

  console.log('\n=== Backfill Complete ===');
  console.log(`Total drugs: ${totalDrugs}`);
  console.log(`Total reports: ${totalReports}`);
  console.log(`Drugs with active status: ${activeDrugs}`);

  await client.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
