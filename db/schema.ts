import { pgTable, pgEnum, text, timestamp, uuid, jsonb, index, boolean, integer } from 'drizzle-orm/pg-core';

// ===========================================
// ENUMS
// ===========================================

/**
 * Drug Status - COMPUTED field based on active report
 * This is NOT from the API - we derive it from the active report's status
 */
export const drugStatusEnum = pgEnum('drug_status', [
  'available',          // No active report (default)
  'in_shortage',        // Has active shortage report
  'anticipated',        // Has anticipated shortage report
  'discontinued',       // Has discontinuation report
  'to_be_discontinued'  // Has to_be_discontinued report
]);

/**
 * Report Type - From Drug Shortages Canada API
 * The API has two report types: shortages and discontinuances
 */
export const reportTypeEnum = pgEnum('report_type', [
  'shortage',
  'discontinuation'
]);

/**
 * Report Status - Values from Drug Shortages Canada
 * Sources:
 * - API filter_status: https://www.drugshortagescanada.ca/blog/52
 * - Summary page: https://www.drugshortagescanada.ca/summary-report
 *
 * Shortage statuses:
 * - active_confirmed = "Actual shortage" (currently in shortage)
 * - anticipated_shortage = "Anticipated shortage" (expected soon)
 * - avoided_shortage = "Avoided shortage" (was anticipated, didn't happen)
 * - resolved = "Resolved" (no longer in shortage)
 *
 * Discontinuation statuses:
 * - to_be_discontinued = "To be discontinued" (will be removed)
 * - discontinued = "Discontinued" (permanently removed)
 * - reversed = "Reversed" (was going to be discontinued, isn't)
 */
export const reportStatusEnum = pgEnum('report_status', [
  // Shortage statuses
  'active_confirmed',
  'anticipated_shortage',
  'avoided_shortage',
  'resolved',
  // Discontinuation statuses
  'to_be_discontinued',
  'discontinued',
  'reversed'
]);

// ===========================================
// TABLES
// ===========================================

/**
 * drugs - The Catalog (one row per medication, ~57k total)
 * Primary lookup by DIN (Drug Identification Number)
 *
 * Contains ALL Canadian drugs from Health Canada DPD (not just those with shortage history).
 * This enables complete search and alternatives coverage.
 *
 * Data sources:
 * - Health Canada DPD bulk extracts (weekly sync) → base drug catalog
 * - Drug Shortages Canada API (15 min poll) → shortage status, report details
 *
 * Sync strategy:
 * - DPD: Weekly bulk extract diff using `dpdLastUpdated` field
 * - DSC: 15 min API poll for active reports, updates `currentStatus` and `hasReports`
 *
 * Field mapping (DPD bulk extract):
 * - din ← DRUG_IDENTIFICATION_NUMBER
 * - drugCode ← DRUG_CODE
 * - brandName/Fr ← BRAND_NAME / BRAND_NAME_F
 * - activeIngredient ← INGREDIENT (from ingred.txt)
 * - strength/Unit ← STRENGTH / STRENGTH_UNIT
 * - form/Fr ← PHARMACEUTICAL_FORM / PHARMACEUTICAL_FORM_F
 * - route/Fr ← ROUTE_OF_ADMINISTRATION / ROUTE_OF_ADMINISTRATION_F
 * - atcCode ← TC_ATC_NUMBER (from ther.txt)
 * - company ← COMPANY_NAME
 * - marketStatus ← STATUS (from status.txt)
 * - numberOfAis ← NUMBER_OF_AIS
 * - aiGroupNo ← AI_GROUP_NO
 * - dpdLastUpdated ← LAST_UPDATE_DATE
 */
export const drugs = pgTable('drugs', {
  id: uuid('id').defaultRandom().primaryKey(),
  din: text('din').notNull().unique(),
  drugCode: integer('drug_code'),                 // DPD/DSC internal ID (for related queries)

  // Names (English and French)
  brandName: text('brand_name'),
  brandNameFr: text('brand_name_fr'),
  commonName: text('common_name'),                // Generic/proper name (English)
  commonNameFr: text('common_name_fr'),           // Generic/proper name (French)

  // Active ingredients (primary - for multi-ingredient drugs, see rawJson)
  activeIngredient: text('active_ingredient'),    // Primary ingredient (English)
  activeIngredientFr: text('active_ingredient_fr'),
  strength: text('strength'),                     // e.g., "500"
  strengthUnit: text('strength_unit'),            // e.g., "MG"
  numberOfAis: integer('number_of_ais'),          // Number of active ingredients
  aiGroupNo: text('ai_group_no'),                 // Active ingredient group number

  // Formulation (primary - from first form/route in array)
  form: text('form'),                             // Pharmaceutical form (English) e.g., "TABLET"
  formFr: text('form_fr'),                        // e.g., "Comprimé"
  route: text('route'),                           // Route of administration (English) e.g., "ORAL"
  routeFr: text('route_fr'),                      // e.g., "Orale"

  // ATC Classification (from DSC therapeutics array)
  atcCode: text('atc_code'),                      // ATC number e.g., "N02BE01"
  atcLevel3: text('atc_level_3'),                 // Level 3 classification e.g., "ANALGESICS"
  atcLevel5: text('atc_level_5'),                 // Level 5 classification e.g., "PARACETAMOL"

  // Company/manufacturer
  company: text('company'),

  // Market status from DSC/DPD
  marketStatus: text('market_status'),            // MARKETED, APPROVED, CANCELLED, DORMANT

  // Computed status based on most severe active report
  // Priority: in_shortage > anticipated > to_be_discontinued > available
  // Query reports by DIN to get full history
  currentStatus: drugStatusEnum('current_status').default('available'),

  // Whether this drug has any shortage/discontinuation reports (current or historical)
  hasReports: boolean('has_reports').default(false),

  // DPD sync tracking - last_update_date from Health Canada bulk extract
  dpdLastUpdated: timestamp('dpd_last_updated'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  // B-tree indexes for exact lookups
  index('drugs_din_idx').on(table.din),
  index('drugs_active_ingredient_idx').on(table.activeIngredient),
  index('drugs_atc_code_idx').on(table.atcCode),
  index('drugs_ai_group_no_idx').on(table.aiGroupNo),
  index('drugs_common_name_idx').on(table.commonName),
  index('drugs_company_idx').on(table.company),
  index('drugs_has_reports_idx').on(table.hasReports),
  index('drugs_current_status_idx').on(table.currentStatus),  // For filtering by shortage status
  index('drugs_market_status_idx').on(table.marketStatus),    // For filtering marketed drugs
  // Note: GIN indexes for pg_trgm fuzzy search are created via raw SQL migration
  // CREATE INDEX drugs_brand_name_trgm ON drugs USING GIN (brand_name gin_trgm_ops);
  // CREATE INDEX drugs_common_name_trgm ON drugs USING GIN (common_name gin_trgm_ops);
  // CREATE INDEX drugs_active_ingredient_trgm ON drugs USING GIN (active_ingredient gin_trgm_ops);
]);

/**
 * reports - Events that happen to medications (many per DIN over time)
 * Tracks shortage and discontinuation reports from Drug Shortages Canada API
 *
 * Each report contains drug info at time of report (denormalized)
 * because drug details may change over time.
 *
 * API field mapping:
 * - reportId ← id (the API report ID)
 * - din ← din
 * - status ← status (active_confirmed, discontinued, etc.)
 * - type ← type.label (shortage, discontinuance)
 * - brandName/Fr ← en_drug_brand_name, fr_drug_brand_name
 * - commonName/Fr ← en_drug_common_name, fr_drug_common_name
 * - ingredients/Fr ← en_ingredients, fr_ingredients (newline-separated)
 * - drugStrength ← drug_strength (e.g., "500MG")
 * - drugDosageForm/Fr ← drug_dosage_form, drug_dosage_form_fr
 * - drugRoute/Fr ← drug_route, drug_route_fr
 * - packagingSize ← drug_package_quantity
 * - atcCode ← atc_number
 * - atcDescription ← atc_description
 * - reasonEn/Fr ← shortage_reason.en_reason/fr_reason OR discontinuance_reason.en_reason/fr_reason
 * - anticipatedStartDate ← anticipated_start_date (shortage)
 * - actualStartDate ← actual_start_date (shortage)
 * - estimatedEndDate ← estimated_end_date (shortage)
 * - actualEndDate ← actual_end_date (shortage) - when shortage actually resolved
 * - anticipatedDiscontinuationDate ← anticipated_discontinuation_date (discontinuation)
 * - discontinuationDate ← discontinuation_date (discontinuation)
 * - apiCreatedDate ← created_date (when DSC received the report)
 * - apiUpdatedDate ← updated_date (when DSC last updated - for sync)
 * - company ← company_name
 * - tier3 ← tier_3 (boolean)
 * - lateSubmission ← late_submission (boolean)
 * - decisionReversal ← decision_reversal (boolean)
 */
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: integer('report_id').notNull().unique(),  // From DSC API (numeric ID)
  din: text('din'),  // 7 historical reports have no DIN

  // Drug info at time of report (denormalized, bilingual)
  brandName: text('brand_name'),                      // en_drug_brand_name
  brandNameFr: text('brand_name_fr'),                 // fr_drug_brand_name
  commonName: text('common_name'),                    // en_drug_common_name
  commonNameFr: text('common_name_fr'),               // fr_drug_common_name
  ingredients: text('ingredients'),                   // en_ingredients (newline-separated)
  ingredientsFr: text('ingredients_fr'),              // fr_ingredients
  drugStrength: text('drug_strength'),                // e.g., "500MG" or "40MG\r\n0.005MG"
  drugDosageForm: text('drug_dosage_form'),           // e.g., "TABLET"
  drugDosageFormFr: text('drug_dosage_form_fr'),      // e.g., "Comprimé"
  drugRoute: text('drug_route'),                      // e.g., "ORAL"
  drugRouteFr: text('drug_route_fr'),                 // e.g., "Orale"
  packagingSize: text('packaging_size'),              // drug_package_quantity e.g., "100 TABLET"

  // Report type and status
  type: reportTypeEnum('type').notNull(),
  status: reportStatusEnum('status').notNull(),

  // Reason (bilingual, from shortage_reason or discontinuance_reason)
  reasonEn: text('reason_en'),                        // English reason
  reasonFr: text('reason_fr'),                        // French reason

  // ATC classification at time of report
  atcCode: text('atc_code'),                          // atc_number
  atcDescription: text('atc_description'),            // atc_description (level 3 name)

  // Dates - Shortage reports
  anticipatedStartDate: timestamp('anticipated_start_date'),
  actualStartDate: timestamp('actual_start_date'),
  estimatedEndDate: timestamp('estimated_end_date'),  // When shortage expected to resolve
  actualEndDate: timestamp('actual_end_date'),        // When shortage actually resolved

  // Dates - Discontinuation reports
  anticipatedDiscontinuationDate: timestamp('anticipated_discontinuation_date'),
  discontinuationDate: timestamp('discontinuation_date'),  // Actual discontinuation date

  // Metadata
  company: text('company'),                           // company_name
  tier3: boolean('tier_3'),                           // Health Canada critical shortage flag
  lateSubmission: boolean('late_submission'),         // Whether report was submitted late
  decisionReversal: boolean('decision_reversal'),     // If discontinuation was reversed

  // API timestamps (for sync tracking)
  apiCreatedDate: timestamp('api_created_date'),      // DSC created_date (when report submitted)
  apiUpdatedDate: timestamp('api_updated_date'),      // DSC updated_date (for incremental sync)

  // Full API response for debugging and future field extraction
  rawJson: jsonb('raw_json'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('reports_din_idx').on(table.din),
  index('reports_updated_at_idx').on(table.updatedAt),
  index('reports_status_idx').on(table.status),
  index('reports_type_idx').on(table.type),
  index('reports_company_idx').on(table.company),
  index('reports_api_updated_date_idx').on(table.apiUpdatedDate),  // For incremental sync
  index('reports_tier3_idx').on(table.tier3),  // For filtering Tier 3 critical shortages
]);

// ===========================================
// SYNC METADATA
// ===========================================

/**
 * sync_metadata - Tracks when sync jobs run (independent of data changes)
 * Solves the problem of sync appearing "stale" when no data changed
 */
export const syncMetadata = pgTable('sync_metadata', {
  id: text('id').primaryKey(),  // 'dsc' or 'dpd'
  lastRunAt: timestamp('last_run_at').notNull(),
  lastSuccessAt: timestamp('last_success_at'),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').default(0),
});

// ===========================================
// TYPE EXPORTS
// ===========================================

export type Drug = typeof drugs.$inferSelect;
export type NewDrug = typeof drugs.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type SyncMetadata = typeof syncMetadata.$inferSelect;
