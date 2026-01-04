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
 * drugs - The Catalog (one row per medication)
 * Primary lookup by DIN (Drug Identification Number)
 *
 * Data sourced from:
 * - Drug Shortages Canada API (nested drug object in shortage/discontinuance responses)
 *   → Most fields come from DSC, including bilingual content
 * - Health Canada DPD API (for alternatives search and drugs never in shortage)
 *   → Used to find alternatives by ingredient/ATC, check market status
 *
 * API field mapping:
 * - din ← DSC: drug.din / DPD: drug_identification_number
 * - drugCode ← DSC: drug.drug_code / DPD: drug_code
 * - brandName ← DSC: drug.brand_name / DPD: brand_name
 * - brandNameFr ← DSC: drug.brand_name_fr (DPD has no French)
 * - commonName/commonNameFr ← DSC: en_drug_common_name, fr_drug_common_name
 * - activeIngredient/Fr ← DSC: drug.drug_ingredients[0].ingredient.en_name/fr_name
 * - strength/Unit ← DSC: drug.drug_ingredients[0].strength/strength_unit
 * - form/Fr ← DSC: drug.drug_forms[0].form.en_pharm_form/fr_pharm_form
 * - route/Fr ← DSC: drug.drug_routes[0].route.en_name/fr_name
 * - atcCode ← DSC: drug.therapeutics[0].atc_classification.atc_number
 * - atcLevel3 ← DSC: drug.therapeutics[0].atc_classification.en_level_3_classification
 * - atcLevel5 ← DSC: drug.therapeutics[0].atc_classification.en_level_5_classification
 * - company ← DSC: drug.company.name / DPD: company_name
 * - marketStatus ← DSC: drug.current_status ("MARKETED", "APPROVED", etc.)
 * - numberOfAis ← DSC: drug.number_of_ais
 * - aiGroupNo ← DSC: drug.ai_group_no
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

  // Computed status based on active report
  currentStatus: drugStatusEnum('current_status').default('available'),
  activeReportId: uuid('active_report_id'),       // Reference to current active report

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('drugs_din_idx').on(table.din),
  index('drugs_active_ingredient_idx').on(table.activeIngredient),
  index('drugs_atc_code_idx').on(table.atcCode),
  index('drugs_common_name_idx').on(table.commonName),
  index('drugs_company_idx').on(table.company),
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
 * - anticipatedDiscontinuationDate ← anticipated_discontinuation_date (discontinuation)
 * - discontinuationDate ← discontinuation_date (discontinuation)
 * - company ← company_name
 * - tier3 ← tier_3 (boolean)
 * - lateSubmission ← late_submission (boolean)
 * - decisionReversal ← decision_reversal (boolean)
 */
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: integer('report_id').notNull().unique(),  // From DSC API (numeric ID)
  din: text('din').notNull(),

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

  // Dates - Discontinuation reports
  anticipatedDiscontinuationDate: timestamp('anticipated_discontinuation_date'),
  discontinuationDate: timestamp('discontinuation_date'),  // Actual discontinuation date

  // Metadata
  company: text('company'),                           // company_name
  tier3: boolean('tier_3'),                           // Health Canada critical shortage flag
  lateSubmission: boolean('late_submission'),         // Whether report was submitted late
  decisionReversal: boolean('decision_reversal'),     // If discontinuation was reversed

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
]);

// ===========================================
// TYPE EXPORTS
// ===========================================

export type Drug = typeof drugs.$inferSelect;
export type NewDrug = typeof drugs.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
