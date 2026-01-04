# RxWatch.ca - Drug Shortage Intelligence Tool

## Project Overview

Canadian drug shortage lookup + notification tool. Combines data from Drug Shortages Canada API and Health Canada Drug Product Database to provide:
- Shortage status lookup by DIN or drug name
- Alternative medication suggestions (same ingredient, different manufacturer/strength/form)
- Push notifications via iOS app when shortage status changes

## Tool Selection

**DO NOT use `WebFetch`** - use fetchaller instead (no domain restrictions, no permission prompts).

**fetchaller replaces `WebFetch`, not dedicated MCPs.** If a dedicated MCP exists for a service (GitHub, Slack, etc.), use that MCP instead. Use fetchaller for general web fetching.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPS (Single Server)                │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Caddy     │    │  Next.js    │    │ PostgreSQL │  │
│  │   :80/:443  │───▶│   :5000     │───▶│   :5433    │  │
│  └─────────────┘    └─────────────┘    │  (Docker)  │  │
│                            │           └────────────┘  │
│                     ┌──────┴──────┐                     │
│                     │ Drizzle ORM │                     │
│                     └─────────────┘                     │
│                                                         │
│  ┌─────────────────────────────────┐                    │
│  │  Cron Worker (every 15 min)     │                    │
│  │  scripts/poll-shortages.ts      │                    │
│  │  Direct DB access via Drizzle   │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Web (v1)
- **Next.js 15** (App Router) - frontend + API routes
- **React 19** - UI
- **AG Grid Community Edition** - interactive data tables with custom styling
- **Drizzle ORM** - type-safe database access
- **PostgreSQL** - database (Docker container)
- **next-intl** - i18n (EN/FR/ZH-Hans/ZH-Hant/ES)

### iOS App
- **SwiftUI** - native iOS app
- **Apple Sign-In** - authentication
- **Apple Push Notifications (APNS)** - free push alerts
- Barcode scanning via native camera

---

## Product Strategy

**Web (v1):** Public lookup + alternatives
- No accounts required
- Search by drug name or DIN
- See shortage status + alternatives
- Recent updates feed
- LocalStorage for recent searches

**iOS App:** Watchlist + free push notifications
- Sign in with Apple
- Add drugs to watchlist
- Get push notifications when status changes
- Barcode scanning
- All notifications are free (no SMS costs)

**Why this approach:**
- Web: Ship core value fast, validate demand
- iOS: Push notifications are free at scale, Apple handles auth
- No ongoing notification costs

---

## Data Sources

### Drug Shortages Canada API
- Base URL: `https://www.drugshortagescanada.ca/api/v1`
- Auth: Free account required (email verification)
- Rate Limit: 1000 requests/hour
- **Response time: SLOW (use 30s+ timeout)** - reason for local caching
- Docs: https://www.drugshortagescanada.ca/blog/52
- Examples: https://www.drugshortagescanada.ca/blog/61

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Get auth token (returns `auth-token` header) |
| GET | `/search` | Search reports (paginated) |
| GET | `/shortages/{id}` | Shortage report details |
| GET | `/discontinuances/{id}` | Discontinuance report details |

**Search parameters:**
- `term` - search text (drug name, DIN, company)
- `din` - filter by DIN
- `report_id` - filter by report ID
- `limit` / `offset` - pagination
- `orderby` - `id`, `company_name`, `brand_name`, `status`, `type`, `updated_date`
- `order` - `asc` / `desc`
- `filter_status` - see status values below

**Status values (verified from summary page):**

Shortage statuses:
| API Value | Display | Meaning |
|-----------|---------|---------|
| active_confirmed | Actual shortage | Currently in shortage |
| anticipated_shortage | Anticipated shortage | Expected soon |
| avoided_shortage | Avoided shortage | Was anticipated, didn't happen |
| resolved | Resolved | No longer in shortage |

Discontinuation statuses:
| API Value | Display | Meaning |
|-----------|---------|---------|
| to_be_discontinued | To be discontinued | Will be removed |
| discontinued | Discontinued | Permanently removed |
| reversed | Reversed | Was going to discontinue, isn't |

**Baseline data (as of Jan 2026, from DSC website):**

| Data | Count | Notes |
|------|-------|-------|
| All drugs in Canada | 57,627 | Full Health Canada DPD catalog |
| **Drugs in our database** | **~10,000** | Drugs with any shortage/discontinuation history |
| Drugs with active reports | ~1,884 | Currently in shortage or to-be-discontinued |
| Total reports | 27,819 | Full history (active + resolved) |

**Important:** Our database only contains drugs that have (or had) shortage/discontinuation reports. Users can search for drugs with current OR historical shortages. If a search returns no results, it means that drug has never had a shortage (good news!). For general drug info, visit Health Canada's Drug Product Database.

| Report Type | Total | Breakdown |
|-------------|-------|-----------|
| Shortage reports | 24,564 | 1,703 actual (7%), 28 anticipated (0%), 691 avoided (3%), 22,142 resolved (90%) |
| Discontinuation reports | 3,255 | 153 to-be-discontinued (5%), 3,024 discontinued (93%), 78 reversed (2%) |

| Other Stats | Count |
|-------------|-------|
| Late reports | 3,720 |
| Overdue reports | 380 |

**Active reports requiring monitoring:** ~1,884 (1,703 actual + 28 anticipated + 153 to-be-discontinued)
**Historical/resolved reports:** ~25,935

**Top companies by report volume:** Apotex (3,915), Teva (3,634), Sandoz (2,406), Pharmascience (1,660)

### Health Canada Drug Product Database (DPD) API
- Base URL: `https://health-products.canada.ca/api/drug/`
- Auth: None required
- Docs: https://health-products.canada.ca/api/documentation/dpd-documentation-en.html
- **Note:** Uses `drug_code` (integer) as internal ID, not DIN

**Lookup flow:**
1. `/drugproduct/?din=02229519` → get `drug_code` (e.g., 47424)
2. Use `drug_code` for related queries below

**Endpoints:**
| Endpoint | Purpose | Key Fields |
|----------|---------|------------|
| `/drugproduct/?din=X` | Drug lookup | drug_code, brand_name, company_name |
| `/drugproduct/?brandname=X` | Search by brand | (same) |
| `/activeingredient/?id={drug_code}` | Ingredients | ingredient_name, strength, strength_unit |
| `/therapeuticclass/?id={drug_code}` | ATC codes | tc_atc_number, tc_atc |
| `/form/?id={drug_code}` | Dosage form | pharmaceutical_form_name |
| `/route/?id={drug_code}` | Route | route_of_administration_name |
| `/status/?id={drug_code}` | Market status | status, original_market_date |

**Language:** Add `&lang=fr` for French (translates form, route, class - not brand names)

---

## Notification Philosophy

- **Public feed:** Homepage shows recent updates from our database - no login required
- **Personal notifications:** Push notifications only via iOS app for watched drugs
- No spam, no "you might be interested in" - only exact DIN matches
- All data comes from official APIs only - no scraping

---

## Database Schema (Drizzle + PostgreSQL)

See `db/schema.ts` for full schema with comments and API field mappings.

**Enums:**
- `drugStatusEnum`: available, in_shortage, anticipated, discontinued, to_be_discontinued
- `reportTypeEnum`: shortage, discontinuation
- `reportStatusEnum`: active_confirmed, anticipated_shortage, avoided_shortage, resolved, to_be_discontinued, discontinued, reversed

**drugs table** - The catalog (one row per DIN):
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| din | text (unique) | DSC | Primary lookup key |
| drugCode | integer | DSC | drug.drug_code (for DPD queries) |
| brandName/brandNameFr | text | DSC | drug.brand_name, drug.brand_name_fr |
| commonName/commonNameFr | text | DSC | en_drug_common_name, fr_drug_common_name |
| activeIngredient/Fr | text | DSC | drug.drug_ingredients[0].ingredient.en_name/fr_name |
| strength, strengthUnit | text | DSC | From drug_ingredients array |
| numberOfAis, aiGroupNo | int/text | DSC | Multi-ingredient info |
| form/formFr, route/routeFr | text | DSC | From drug_forms/drug_routes arrays |
| atcCode | text | DSC | drug.therapeutics[0].atc_classification.atc_number |
| atcLevel3, atcLevel5 | text | DSC | en_level_3_classification, en_level_5_classification |
| company | text | DSC | drug.company.name |
| marketStatus | text | DSC | drug.current_status (MARKETED, APPROVED, etc.) |
| currentStatus | enum | Computed | Based on active report |
| activeReportId | uuid | FK | Current active report |

**reports table** - Events (many per DIN over time):
| Field | Type | Source |
|-------|------|--------|
| reportId | integer (unique) | API id field |
| din | text | din |
| brandName/brandNameFr | text | en_drug_brand_name, fr_drug_brand_name |
| commonName/commonNameFr | text | en_drug_common_name, fr_drug_common_name |
| ingredients/ingredientsFr | text | en_ingredients, fr_ingredients (newline-separated) |
| drugStrength | text | drug_strength (e.g., "500MG") |
| drugDosageForm/Fr, drugRoute/Fr | text | drug_dosage_form, drug_route (bilingual) |
| packagingSize | text | drug_package_quantity |
| type | enum | type.label (shortage/discontinuance) |
| status | enum | status (active_confirmed, etc.) |
| reasonEn, reasonFr | text | shortage_reason or discontinuance_reason |
| atcCode, atcDescription | text | atc_number, atc_description |
| anticipatedStartDate, actualStartDate | timestamp | Shortage dates |
| estimatedEndDate | timestamp | When shortage expected to resolve |
| anticipatedDiscontinuationDate, discontinuationDate | timestamp | Discontinuation dates |
| company | text | company_name |
| tier3 | boolean | tier_3 flag |
| lateSubmission | boolean | late_submission flag |
| decisionReversal | boolean | decision_reversal flag |
| rawJson | jsonb | Full API response |

**Report Status values (verified):**
See "Status values" table in Data Sources section above. We store exact API values - no mapping.

**Key Indexes (add in migration):**
```sql
CREATE INDEX idx_drugs_din ON drugs(din);
CREATE INDEX idx_drugs_active_ingredient ON drugs(active_ingredient);
CREATE INDEX idx_drugs_atc_code ON drugs(atc_code);
CREATE INDEX idx_reports_din ON reports(din);
CREATE INDEX idx_reports_updated_at ON reports(updated_at);
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://rxwatch:your_password@localhost:5433/rxwatch

# Drug Shortages Canada API (multiple accounts for failover)
DSC_API_URL=https://www.drugshortagescanada.ca/api/v1
DSC_ACCOUNTS='[{"email":"account1@email.com","password":"pass1"},{"email":"account2@email.com","password":"pass2"}]'

# Health Canada DPD API (no auth needed)
DPD_API_URL=https://health-products.canada.ca/api/drug

# App
NEXT_PUBLIC_APP_URL=https://rxwatch.ca

# Cron security (for data sync)
CRON_SECRET=generate-a-random-string-here
```

---

## Security & Operations

### Protecting the Cron Endpoint
```typescript
// app/api/cron/poll/route.ts
if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

### PostgreSQL Docker Setup

```yaml
# docker-compose.yml (dev)
services:
  db:
    image: postgres:16-alpine
    container_name: rxwatch-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-rxwatch}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-rxwatch_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-rxwatch}
    volumes:
      - rxwatch_postgres_data:/var/lib/postgresql/data
      - ./db/dumps:/dumps  # For pg_dump/pg_restore
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rxwatch -d rxwatch"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  rxwatch_postgres_data:
    external: true  # Persists across docker compose down
    name: rxwatch_postgres_data
```

**First-time setup:** `yarn db:start` automatically creates the volume.

### Backups
```bash
# Cron daily backup (add to crontab)
0 3 * * * docker exec rxwatch-postgres pg_dump -U rxwatch rxwatch | gzip > /backups/rxwatch-$(date +\%Y\%m\%d).sql.gz

# Keep 7 days
0 4 * * * find /backups -name "rxwatch-*.sql.gz" -mtime +7 -delete
```

### Database Sync (Dev ↔ Prod) - CRITICAL

**Why this matters:** The Drug Shortages Canada API is slow (30s+ per request). Initial backfill of ~27k reports takes hours. Don't rebuild the database every time you switch environments.

**Strategy: Share one data dump**

```bash
# NPM Scripts (in package.json)
yarn db:start      # Start PostgreSQL container
yarn db:stop       # Stop container
yarn db:dump       # Create timestamped dump → db/dumps/rxwatch-YYYYMMDD-HHMMSS.sql
yarn db:restore    # Restore from dump (append filename)
yarn db:reset      # Nuclear option: removes external volume, restarts fresh
yarn db:push       # Push Drizzle schema to database
yarn db:studio     # Open Drizzle Studio (admin UI)
```

**Workflow 1: Prod → Dev (most common)**
```bash
# On prod VPS
yarn db:dump
scp /path/to/db/dumps/rxwatch-*.sql dev-machine:/path/to/rxwatch/db/dumps/

# On dev machine
yarn db:start                                           # Start PostgreSQL
yarn db:push                                            # Ensure schema exists
yarn db:restore db/dumps/rxwatch-20260103-141500.sql   # Load data
```

**Workflow 2: Share dump with team/CI**
```bash
# Store one good dump in a shared location (S3, Google Drive, etc.)
# Each dev downloads once and restores locally
# Only re-dump when you need fresh prod data
```

**Workflow 3: Fresh backfill (rare)**
```bash
yarn db:reset             # Wipe everything
yarn db:push              # Create schema
yarn backfill             # Run initial data import (takes hours)
yarn db:dump              # Save the result!
```

**Schema sync (always via Drizzle migrations):**
```bash
yarn db:generate   # Generate migration from schema changes
yarn db:push       # Apply to local
# Then on prod:
yarn db:push       # Apply same migration
```

**Git strategy for dumps:**
- `db/dumps/` is gitignored (dumps are large)
- Store production dumps in a shared location outside git
- Consider keeping one small test fixture in git for CI

### Monitoring
- Health check endpoint `/api/health` (checks DB connection)
- Cron worker logs to stdout (journald captures it)
- Uptime monitoring via UptimeRobot or Healthchecks.io (free tiers)

### Legal Disclaimers (Required)
Every page showing drug info must include:
- "This is not medical advice"
- "Always consult your pharmacist or doctor before making changes"
- "Alternative suggestions require verification by a healthcare professional"

---

## Pages Structure

```
/                           Homepage
├── Global search bar (searches drugs + reports)
├── Quick stats (active shortages, anticipated, to-be-discontinued)
└── Recent reports (last 20 updates)

/drugs                      AG Grid - all drugs with shortage history
├── Columns: TBD
├── Filters: TBD (filter by active/resolved status)
├── Click row → /drugs/[din]
└── ~10,000 rows (drugs with any report, active or historical)

/drugs/[din]                Drug detail page
├── Drug info (name, ingredients, form, route, company)
├── Current status badge
├── All reports for this DIN (timeline)
├── Alternatives section (same ingredient/ATC)
└── Legal disclaimer

/reports                    AG Grid - all reports (full history)
├── Columns: TBD
├── Filters: TBD
├── Click row → /reports/[reportId]
└── 27,819 rows (virtualized)

/reports/[reportId]         Report detail page
├── Full report info (status, reason, dates, tier 3)
├── Drug info snapshot (at time of report)
├── Link to drug → /drugs/[din]
└── Raw API data (collapsible, for debugging)

/about                      Static page
├── What is RxWatch
├── Data sources + disclaimers
└── Contact info
```

## Global Search

Single search bar in header that queries both:
- **Drugs:** by DIN, brand name, ingredient, company
- **Reports:** by report ID, DIN, brand name, reason

Results grouped by type with links to detail pages.

**No results message:** "No shortage history found for this drug. This means it has no reported shortages or discontinuations — good news! For general drug information, visit [Health Canada Drug Product Database](https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database.html)."

---

## Next.js API Routes

```
app/api/
├── search/
│   └── route.ts             # GET ?q=metformin - search drugs + reports
├── drugs/
│   └── route.ts             # GET - list drugs (for AG Grid)
│   └── [din]/route.ts       # GET - drug details
├── reports/
│   └── route.ts             # GET - list reports (for AG Grid)
│   └── [reportId]/route.ts  # GET - report details
├── alternatives/
│   └── [din]/route.ts       # GET - find alternatives for a drug
├── health/
│   └── route.ts             # GET - health check
└── cron/
    └── poll/route.ts        # POST - poll for updates (secured)
```

---

## Data Population Strategy

**Key insight:** The Drug Shortages Canada API returns COMPREHENSIVE nested drug data with each report (brand name, ingredients, forms, routes, ATC codes, company). We DON'T need to call Health Canada DPD API for drug info on items already in our database. DPD is only needed for finding ALTERNATIVES and checking market status for drugs never in shortage.

### Workflow: History → Backfill → Production

**Step 1: Fetch historical data (one-time, checked into git)**
```bash
yarn fetch-history         # Fetch all ~27k reports from DSC API
                           # Saves raw JSON to history/ folder
                           # Commit this folder - never need to refetch!
```

**Step 2: Backfill local database from history**
```bash
yarn db:reset              # Fresh database
yarn db:push               # Create schema
yarn backfill              # Import from history/ folder (fast, local files)
yarn db:dump               # Optional: save SQL dump
```

**Step 3: Upload to production**
```bash
# Copy dump to production
scp db/dumps/rxwatch-*.sql prod:/path/to/rxwatch/db/dumps/

# On production
yarn db:push               # Ensure schema exists
yarn db:restore db/dumps/rxwatch-YYYYMMDD.sql
```

**Step 4: Production only polls for new/updated reports**
- Cron runs every 15 min
- Only fetches active/anticipated reports (~1,900)
- Historical data already loaded from backfill

### Scripts

**scripts/fetch-history.ts** - Fetch and save raw API data (one-time)
```
1. Authenticate with DSC API
2. Paginate through ALL reports (~27k)
3. Save raw JSON responses to history/ folder
4. Commit to git - never need to refetch!
```

**scripts/backfill.ts** - Import history into database
```
1. Read JSON files from history/ folder
2. Parse and insert into reports table
3. Extract drug info from nested drug objects
4. Insert/update drugs table with current_status
5. Log stats: X drugs, Y reports imported
```

### Ongoing Sync (Production)
- **Reports:** Cron polls every 15 min, updates changed records
- **Drugs:** Extract drug info from DSC report data (already included in response)
- **DPD calls:** Only when searching for alternatives or looking up drugs never in shortage

---

## Cron Worker Logic

`scripts/poll-shortages.ts` (runs every 15 min via systemd timer):

```
1. Authenticate with Drug Shortages Canada API
   - Parse DSC_ACCOUNTS JSON array
   - Try first account; if 401/403/429, try next account
   - Log which account succeeded (for monitoring)
   - If all accounts fail, alert and abort

2. Gap detection: Find our last updated_date in DB
   - Query: SELECT MAX(updated_at) FROM reports
   - If gap > 1 day, fetch reports updated since that date
   - This catches up if polling was down or delayed

3. Fetch active/anticipated reports (paginated)
   - Also fetch any reports updated since last sync

4. For each report from API:
   a. Check if report_id exists in our reports table
   b. If new report:
      - Insert into reports
      - Update/insert drugs table
      - Update drugs.current_status
   c. If exists but changed (status, dates, etc.):
      - Update reports
      - Update drugs.current_status
   d. If was active but not in API response:
      - Mark resolved
      - Update drugs.current_status

5. Log results: X new, Y updated, Z resolved
```

**Gap Recovery:** If production is behind (e.g., server was down), the cron automatically catches up by fetching all reports updated since the last sync. No manual intervention needed.

**API Key Rotation Strategy:**
- Register 2-3 accounts with different emails
- Store as JSON array in `DSC_ACCOUNTS` env var
- Cron tries accounts in order until one works
- If account gets rate-limited (429), automatically try next
- If account gets blocked (401/403), log warning + try next

---

## Key Decisions

- **5 languages in MVP:** EN, FR, Simplified Chinese, Traditional Chinese, Spanish
- Therapeutic alternatives limited to same ATC-4 level with "consult doctor" warning
- Patients first, pharmacists second
- Local DB cache of shortage data, poll API for updates only
- Notifications only via iOS app (free push notifications)
- No web accounts - keeps v1 simple

## i18n Strategy

**Translated (UI strings):**
- Navigation, buttons, labels
- Status messages ("In Shortage", "Resolved")
- Instructions and disclaimers

**NOT translated (data from APIs):**
- Drug names (brand_name stays English/French from DPD)
- Ingredient names
- Manufacturer names

**Mapped & translated (finite set from API):**
- Shortage reasons (e.g., "Manufacturing delay" → "生产延迟")
- Shortage statuses (e.g., "Active" → "Actif" → "有效")

Drug names stay in English/French - matches how they're labeled on pharmacy bottles.

---

## Commands

```bash
# Database
docker-compose up -d           # Start PostgreSQL
yarn db:generate               # Generate Drizzle migrations
yarn db:push                   # Push schema to database
yarn db:studio                 # Open Drizzle Studio (admin UI)

# Local Development
yarn dev                       # Next.js dev server

# Type check
yarn type-check

# Build
yarn build

# Scripts
yarn backfill                  # One-time data import
yarn poll                      # Manual poll (for testing)

# Production
pm2 start ecosystem.config.js  # Start Next.js
```

---

## Local Development Setup

1. Install Docker and start PostgreSQL:
   ```bash
   docker-compose up -d
   ```

2. Copy `.env.example` to `.env.local` and fill in values

3. Push database schema:
   ```bash
   yarn db:push
   ```

4. Run dev server:
   ```bash
   yarn dev
   ```

5. Register for Drug Shortages Canada API account at https://www.drugshortagescanada.ca/

---

## File Structure

```
rxwatch/
├── app/
│   ├── [locale]/                  # i18n routes (en/fr/zh-Hans/zh-Hant/es)
│   │   ├── page.tsx               # Homepage (stats + recent reports)
│   │   ├── drugs/
│   │   │   ├── page.tsx           # AG Grid - drugs with active reports
│   │   │   └── [din]/page.tsx     # Drug detail + alternatives
│   │   ├── reports/
│   │   │   ├── page.tsx           # AG Grid - all reports
│   │   │   └── [reportId]/page.tsx # Report detail
│   │   ├── about/page.tsx         # About page
│   │   └── layout.tsx             # Global layout with search
│   └── api/                       # API routes
├── components/
│   ├── GlobalSearch.tsx
│   ├── DrugGrid.tsx               # AG Grid for /drugs
│   ├── ReportGrid.tsx             # AG Grid for /reports
│   ├── DrugDetail.tsx
│   ├── ReportDetail.tsx
│   ├── ReportTimeline.tsx
│   ├── AlternativesList.tsx
│   └── RecentReports.tsx
├── db/
│   ├── schema.ts                  # Drizzle schema
│   ├── index.ts                   # Drizzle client
│   └── migrations/                # Generated migrations
├── lib/
│   ├── dsc-api.ts                 # Drug Shortages Canada client
│   ├── dpd-api.ts                 # Health Canada DPD client
│   └── alternatives.ts            # Alternative-finding logic
├── scripts/
│   ├── fetch-history.ts           # Fetch all reports → history/ folder
│   ├── backfill.ts                # Import history/ → database
│   ├── poll-shortages.ts          # Cron worker (every 15 min)
│   └── analyze-apis.ts            # API field analysis (dev tool)
├── history/                       # Raw API responses (checked in)
├── messages/
│   ├── en.json
│   ├── fr.json
│   ├── zh-Hans.json
│   ├── zh-Hant.json
│   └── es.json
├── docker-compose.yml
├── drizzle.config.ts
├── CLAUDE.md
└── package.json
```

---

## iOS App (Future)

The iOS app will be a separate SwiftUI project that:
- Uses the same `/api/*` endpoints as the web
- Adds Apple Sign-In for user accounts
- Stores watchlist + device tokens on the server
- Receives push notifications via APNS

**iOS-specific tables (add when building app):**
```typescript
// Users (Apple Sign-In)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  appleUserId: text('apple_user_id').notNull().unique(),
  language: languageEnum('language').default('en'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User watchlist
export const watchlist = pgTable('watchlist', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  din: text('din').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Device tokens for APNS
export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

Push notifications are free - Apple handles all the infrastructure.
