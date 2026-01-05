# RxWatch.ca - Drug Shortage Intelligence Tool

## Build Progress

**Last updated:** Jan 5, 2026

### What's Done
- [x] Database schema (Drizzle + PostgreSQL)
- [x] DSC history fetch script (`scripts/fetch-history.ts`) - 27,823 reports
- [x] DSC backfill script (`scripts/backfill.ts`) - imports history to DB
- [x] DPD sync script (`scripts/sync-dpd.ts`) - 57,512 drugs with caching
- [x] DSC sync script (`scripts/sync-dsc.ts`) - incremental sync every 15 min
- [x] Basic Next.js layout with sidebar navigation
- [x] Theme toggle (light/dark)
- [x] SQL dump created for prod deployment (107MB)
- [x] pg_trgm extension + GIN indexes for fuzzy search
- [x] API routes (`/api/drugs`, `/api/reports`, `/api/search`, `/api/health`)

### What's Not Built Yet
- [ ] Homepage with search + recent reports + stats
- [ ] `/drugs` page with AG Grid
- [ ] `/drugs/[din]` detail page with alternatives
- [ ] `/reports` page with AG Grid
- [ ] `/reports/[id]` detail page
- [ ] `/stats` analytics page with charts
- [ ] `/about` static page
- [ ] Global search component
- [ ] i18n (EN/FR)
- [ ] iOS app

### Database Stats
| Data | Count |
|------|-------|
| Drugs (from DPD) | 57,512 |
| Reports (from DSC) | 27,823 |
| Drugs with shortage history | 8,777 |
| Drugs with ATC codes | 47,379 (82%) |

---

## Project Overview

Canadian drug shortage lookup + notification tool. Combines data from Drug Shortages Canada API and Health Canada Drug Product Database to provide:
- Shortage status lookup by DIN or drug name
- Alternative medication suggestions (same ingredient, different manufacturer/strength/form)
- Push notifications via iOS app when shortage status changes

## Tool Selection

**DO NOT use `WebFetch`** - use fetchaller instead (no domain restrictions, no permission prompts).

**fetchaller replaces `WebFetch`, not dedicated MCPs.** If a dedicated MCP exists for a service (GitHub, Slack, etc.), use that MCP instead. Use fetchaller for general web fetching.

**shadcn MCP** - Use the shadcn MCP server for all shadcn/ui component operations:
- Browse available components: "Show me all shadcn components"
- Search components: "Find a login form component"
- Install components: "Add the button, card, and sidebar components"
- The MCP connects to the shadcn registry and handles installation automatically
- Config: `.mcp.json` in project root
- **Before web searching for shadcn info**, review: https://ui.shadcn.com/llms.txt

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
│  │  scripts/sync-dsc.ts            │                    │
│  │  Direct DB access via Drizzle   │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Web (v1)
- **Next.js 15** (App Router) - frontend + API routes
- **React 19** - UI
- **Tailwind CSS** - styling
- **shadcn/ui** - UI components (Tailwind-based, copy-paste)
- **Framer Motion** - subtle animations
- **AG Grid Community** - data tables (/drugs, /reports)
- **Recharts** - charts (/stats page, via shadcn/ui charts)
- **Drizzle ORM** - type-safe database access
- **PostgreSQL** - database (Docker container)
- **next-intl** - i18n (EN/FR only for MVP)

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

**Baseline data (as of Jan 2026):**

| Data | Count | Notes |
|------|-------|-------|
| **All drugs in our database** | **57,512** | Full Health Canada DPD catalog (for search + alternatives) |
| Drugs with shortage history | 8,777 | Have at least one report |
| Drugs with active reports | ~1,884 | Currently in shortage or to-be-discontinued |
| Total reports | 27,823 | Full history (active + resolved) |

**Why index all 57k drugs?**
- Better alternatives coverage - a drug in shortage might have alternatives that never had shortages
- Complete search - users can search ANY Canadian drug
- 57k is tiny for PostgreSQL - no performance impact

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

**Company accountability:** Raw report counts are misleading (large generics manufacturers have more reports simply because they make more drugs). For meaningful analytics, calculate **late reporting rate by company** - percentage of reports submitted late. This shows compliance behavior, not just company size.

### Health Canada Drug Product Database (DPD)
- Base URL: `https://health-products.canada.ca/api/drug/`
- Auth: None required
- Docs: https://health-products.canada.ca/api/documentation/dpd-documentation-en.html
- **Note:** Uses `drug_code` (integer) as internal ID, not DIN

**API Endpoints (used for sync):**
| Endpoint | Purpose | Key Fields |
|----------|---------|------------|
| `/drugproduct/` | List ALL drugs (57k) | drug_code, din, brand_name, last_update_date |
| `/drugproduct/?din=X` | Single drug lookup | drug_code, brand_name, last_update_date |
| `/activeingredient/?id={drug_code}` | Ingredients | ingredient_name, strength, strength_unit |
| `/form/?id={drug_code}` | Dosage form | pharmaceutical_form_name |
| `/route/?id={drug_code}` | Route | route_of_administration_name |
| `/therapeuticclass/?id={drug_code}` | ATC codes | tc_atc_number, tc_atc |
| `/status/?id={drug_code}` | Market status | status (MARKETED, APPROVED, etc.) |

**Why we use API instead of bulk ZIP extracts:**
- ZIP extracts (`allfiles.zip`) only contain ~13k marketed drugs
- API `/drugproduct/` endpoint returns all 57,658 drugs (including non-marketed)
- API provides consistent JSON format, no CSV parsing needed
- Trade-off: 5 API calls per drug during backfill (~290k total calls, ~1-2 hours)

**Language:** Add `&lang=fr` for French (translates form, route, class - not brand names)

---

## Notification Philosophy

- **Public feed:** Homepage shows recent updates from our database - no login required
- **Personal notifications:** Push notifications only via iOS app for watched drugs
- No spam, no "you might be interested in" - only exact DIN matches
- All data comes from official APIs only - no scraping

---

## Search Strategy

**Current approach:** PostgreSQL pg_trgm + GIN indexes (upgradable to Meilisearch later)

```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fast fuzzy search (defined in schema.ts)
CREATE INDEX drugs_brand_name_trgm ON drugs USING GIN (brand_name gin_trgm_ops);
CREATE INDEX drugs_common_name_trgm ON drugs USING GIN (common_name gin_trgm_ops);
CREATE INDEX drugs_active_ingredient_trgm ON drugs USING GIN (active_ingredient gin_trgm_ops);
```

**Search query (handles typos like "metforman" → "metformin"):**
```sql
SELECT * FROM drugs
WHERE brand_name % $1           -- trigram similarity
   OR common_name % $1
   OR active_ingredient % $1
   OR din = $1                  -- exact DIN match
ORDER BY
  CASE WHEN din = $1 THEN 0 ELSE 1 END,  -- exact DIN first
  similarity(brand_name, $1) DESC
LIMIT 20;
```

**Performance:** 10-50ms for 57k drugs (acceptable with 300ms debounce)

**Upgrade path to Meilisearch (if needed):**
1. Add Meilisearch container to docker-compose
2. Sync drugs/reports to Meilisearch on cron
3. Swap query in `/api/search/route.ts`
4. Zero schema changes - drop-in replacement

---

## Data Sync Strategy

### Two data sources, two sync methods:

| Source | Method | Frequency | Records |
|--------|--------|-----------|---------|
| **DSC (reports)** | API poll | Every 15 min | ~1,900 active |
| **DPD (drugs)** | API with change detection | Daily 4am EST | 57k total |

### DSC Sync (scripts/sync-dsc.ts)

Polls Drug Shortages Canada API every 15 minutes:
1. Authenticate with DSC API (rotate accounts on rate limit)
2. Fetch active/anticipated reports
3. Compare with database, insert/update changed records
4. Update `drugs.currentStatus` based on active reports
5. Gap detection: if last sync > 1 day, fetch all reports since then

### DPD Sync (scripts/sync-dpd.ts)

**Two modes:**

**1. Backfill (`--backfill`)** - One-time full catalog sync:
```bash
yarn sync-dpd:backfill    # Fetches all 57k drugs with full details
                          # Takes ~1-2 hours (API rate limited)
```
- Fetches drug list from `/drugproduct/` endpoint (57k drugs, ~15MB JSON)
- For each drug, fetches 4 detail endpoints in parallel:
  - `/activeingredient/?id={drug_code}` - ingredients, strength
  - `/form/?id={drug_code}` - dosage form
  - `/route/?id={drug_code}` - route of administration
  - `/therapeuticclass/?id={drug_code}` - ATC codes
  - `/status/?id={drug_code}` - market status
- Runs 20 concurrent requests for speed
- Uses COALESCE on upsert to preserve existing DSC data (common_name, etc.)
- Saves sync state to `.dpd-sync-state.json`

**2. From Cache (`--from-cache`)** - Reimport from local cache:
```bash
yarn sync-dpd:from-cache  # Import from dpd/ folder (no API calls)
                          # Fast: ~30 seconds vs 1-2 hours
```
- Used to reimport after backfill without hitting API again
- Useful for: fresh database restore, schema changes, debugging

**3. Incremental (default)** - Daily sync with smart change detection:
```bash
yarn sync-dpd             # Daily sync (skips if no changes)
yarn sync-dpd --force     # Force full sync (bypass change detection)
```
- First: HEAD request checks Content-Length (~14MB file size)
- If unchanged AND < 1 month since full sync: **skips instantly** (~1 sec)
- If changed OR > 1 month: downloads list, compares `last_update_date`
- Only fetches details for new or changed drugs
- Typically processes 0-100 drugs when changes found

**Local cache (dpd/ folder):**
- `dpd/drug-list.json` - All drugs from API (~15MB)
- `dpd/drugs/{din}.json` - Per-DIN details (~57k files)
- Gitignored (too large for git), but persists locally
- Backfill is resumable: reruns skip already-cached drugs
- DB inserts happen incrementally (every 500 drugs)

**Why API instead of bulk ZIP extracts?**
- ZIP extracts only contain ~13k marketed drugs, API has all 57k
- API provides complete detail in standard format
- No CSV parsing complexity
- Trade-off: More API calls, but one-time backfill then fast incremental

---

## Database Schema (Drizzle + PostgreSQL)

See `db/schema.ts` for full schema with comments and API field mappings.

**Enums:**
- `drugStatusEnum`: available, in_shortage, anticipated, discontinued, to_be_discontinued
- `reportTypeEnum`: shortage, discontinuation
- `reportStatusEnum`: active_confirmed, anticipated_shortage, avoided_shortage, resolved, to_be_discontinued, discontinued, reversed

**drugs table** - The catalog (one row per DIN, 57k total):
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| din | text (unique) | DPD/DSC | Primary lookup key |
| drugCode | integer | DPD | drug_code (for related DPD queries) |
| brandName/brandNameFr | text | DPD/DSC | Brand name (bilingual) |
| commonName/commonNameFr | text | DSC | Generic/proper name (from reports) |
| activeIngredient/Fr | text | DPD | Primary ingredient |
| strength, strengthUnit | text | DPD | e.g., "500", "MG" |
| numberOfAis, aiGroupNo | int/text | DPD | Multi-ingredient info (for alternatives) |
| form/formFr, route/routeFr | text | DPD | Dosage form, route of administration |
| atcCode | text | DPD | ATC classification number |
| atcLevel3, atcLevel5 | text | DPD | ATC level descriptions |
| company | text | DPD | Manufacturer/DIN owner |
| marketStatus | text | DPD | MARKETED, APPROVED, DORMANT, CANCELLED |
| currentStatus | enum | Computed | Most severe active report (in_shortage > anticipated > to_be_discontinued > available) |
| hasReports | boolean | Computed | true if any shortage/discontinuation history |
| dpdLastUpdated | timestamp | DPD | `last_update_date` from DPD (for incremental sync) |

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
| actualEndDate | timestamp | When shortage actually resolved |
| anticipatedDiscontinuationDate, discontinuationDate | timestamp | Discontinuation dates |
| company | text | company_name |
| tier3 | boolean | tier_3 flag |
| lateSubmission | boolean | late_submission flag |
| decisionReversal | boolean | decision_reversal flag |
| apiCreatedDate | timestamp | DSC created_date (when report submitted) |
| apiUpdatedDate | timestamp | DSC updated_date (for incremental sync) |
| rawJson | jsonb | Full API response |

**Report Status values (verified):**
See "Status values" table in Data Sources section above. We store exact API values - no mapping.

**Key Indexes (defined in schema.ts):**
```sql
-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- drugs table - B-tree indexes
CREATE INDEX idx_drugs_din ON drugs(din);
CREATE INDEX idx_drugs_active_ingredient ON drugs(active_ingredient);
CREATE INDEX idx_drugs_atc_code ON drugs(atc_code);
CREATE INDEX idx_drugs_ai_group_no ON drugs(ai_group_no);
CREATE INDEX idx_drugs_common_name ON drugs(common_name);
CREATE INDEX idx_drugs_company ON drugs(company);
CREATE INDEX idx_drugs_has_reports ON drugs(has_reports);

-- drugs table - GIN indexes for fuzzy search (pg_trgm)
CREATE INDEX idx_drugs_brand_name_trgm ON drugs USING GIN (brand_name gin_trgm_ops);
CREATE INDEX idx_drugs_common_name_trgm ON drugs USING GIN (common_name gin_trgm_ops);
CREATE INDEX idx_drugs_active_ingredient_trgm ON drugs USING GIN (active_ingredient gin_trgm_ops);

-- reports table
CREATE INDEX idx_reports_din ON reports(din);
CREATE INDEX idx_reports_updated_at ON reports(updated_at);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_company ON reports(company);
CREATE INDEX idx_reports_api_updated_date ON reports(api_updated_date);
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
```

---

## Security & Operations

### Cron Scripts
Data sync is handled by standalone TypeScript scripts, not API routes:
- `scripts/sync-dsc.ts` - Runs every 15 min to sync DSC shortage reports
- `scripts/sync-dpd.ts` - Runs daily at 4 AM EST to sync DPD drug catalog

Scripts connect directly to the database via `DATABASE_URL` environment variable.

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

**Workflow 3: Fresh backfill (rare - initial setup)**
```bash
yarn db:reset             # Wipe everything
yarn db:push              # Create schema
yarn backfill             # Import DSC reports from history/ folder
yarn sync-dpd:backfill    # Fetch full DPD drug catalog (57k drugs, ~1-2 hours)
yarn db:dump              # Save the complete database!
```

**Workflow 4: Production initial setup**
```bash
# On dev machine (do the heavy lifting)
yarn db:reset && yarn db:push
yarn backfill                    # DSC reports
yarn sync-dpd:backfill           # DPD drugs (1-2 hours)
yarn db:dump                     # Creates db/dumps/rxwatch-YYYYMMDD-HHMMSS.sql

# Copy to production
scp db/dumps/rxwatch-*.sql prod-server:/path/to/rxwatch/db/dumps/

# On production
yarn db:start                    # Start PostgreSQL
yarn db:push                     # Create schema
yarn db:restore db/dumps/rxwatch-YYYYMMDD-HHMMSS.sql
# Set up cron for DSC poll (every 15 min) and DPD sync (daily 4am EST)
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
/                           Homepage (search-first design)
├── Hero: Large search bar front and center
│   └── "Check if your medication is in shortage"
├── Quick stats below search (active shortages, anticipated, to-be-discontinued)
├── Data freshness indicator ("Last synced: 5 min ago")
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
└── 27,823 rows (virtualized)

/reports/[reportId]         Report detail page
├── Full report info (status, reason, dates, tier 3)
├── Drug info snapshot (at time of report)
├── Link to drug → /drugs/[din]
└── Raw API data (collapsible, for debugging)

/stats                      Insights & Analytics
├── Shortage trends over time (line chart)
├── Active shortages by drug category (ATC level 2/3)
├── Tier 3 critical shortages (current + historical)
├── Late reporting rate by company (accountability)
│   └── Top 10 companies by % of reports submitted late
├── Average shortage duration by category
└── Data freshness indicator

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

**Search results - three states:**

1. **Valid DIN, in our database:** Show drug details + all reports
2. **Valid DIN format, not in our database:** "No shortage history found for DIN {din}. This means this drug has never had a reported shortage or discontinuation — good news! For general drug information, visit [Health Canada Drug Product Database](link)."
3. **Invalid DIN format / text search with no matches:** "No results found for '{query}'. Try searching by DIN (8 digits), brand name, or ingredient."

---

## Next.js API Routes

```
app/api/
├── search/route.ts                  # GET ?q=metformin - fuzzy search
├── drugs/route.ts                   # GET - list drugs (AG Grid)
├── drugs/[din]/route.ts             # GET - drug details + reports
├── drugs/[din]/alternatives/route.ts # GET - find alternatives
├── reports/route.ts                 # GET - list reports (AG Grid)
├── reports/[id]/route.ts            # GET - report details
├── stats/route.ts                   # GET - aggregate stats
└── health/route.ts                  # GET - health check
```

**Query params for filtering (all optional, combine as needed):**

`GET /api/drugs`
| Param | Example | Description |
|-------|---------|-------------|
| `hasReports` | `true` | Only drugs with shortage history (~8,800) |
| `status` | `in_shortage` | Filter by currentStatus |
| `company` | `PFIZER` | Partial match, case-insensitive |
| `atc` | `N02` | ATC code prefix |
| `ingredient` | `metformin` | Partial match on active ingredient |
| `marketed` | `true` | Only marketed drugs |

`GET /api/reports`
| Param | Example | Description |
|-------|---------|-------------|
| `active` | `true` | Only active reports (~1,900) |
| `type` | `shortage` | shortage or discontinuation |
| `status` | `active_confirmed` | Exact status match |
| `company` | `PFIZER` | Partial match, case-insensitive |
| `din` | `02345678` | Exact DIN match |
| `tier3` | `true` | Only Tier 3 critical shortages |
| `late` | `true` | Only late submissions |
| `since` | `2024-01-01` | Updated since date (ISO) |

`GET /api/search?q=metforman`
- Fuzzy search using pg_trgm (handles typos)
- Searches brand name, common name, active ingredient
- Exact DIN match if 8 digits

`GET /api/drugs/[din]`
- Returns drug details + all reports for that DIN

`GET /api/drugs/[din]/alternatives`
| Param | Example | Description |
|-------|---------|-------------|
| `availableOnly` | `true` | Only alternatives not in shortage |

Returns two categories:
- `sameIngredient` - Generic equivalents (same active ingredient)
- `sameTherapeuticClass` - Same ATC code, different ingredient

`GET /api/reports/[id]`
- Returns report details + linked drug info

`GET /api/stats`
- Aggregate stats: totals, by status, top companies, late rates

Note: Data sync is handled by standalone scripts (`scripts/sync-dsc.ts`, `scripts/sync-dpd.ts`) run via cron, not API routes.

---

## Data Population Strategy

**Key insight:** The Drug Shortages Canada API returns COMPREHENSIVE nested drug data with each report (brand name, ingredients, forms, routes, ATC codes, company). We DON'T need to call Health Canada DPD API for drug info on items already in our database. DPD is only needed for finding ALTERNATIVES and checking market status for drugs never in shortage.

### Workflow: History → Backfill → DPD → Production

**Step 1: Fetch historical DSC data (one-time, checked into git)**
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
```

**Step 3: Backfill full drug catalog from DPD**
```bash
yarn sync-dpd:backfill     # Fetch all 57k drugs from Health Canada API
                           # Takes ~1-2 hours (API rate limited)
                           # Fills in drugs without shortage history
yarn db:dump               # Save SQL dump with full catalog
```

**Step 4: Upload to production**
```bash
# Copy dump to production
scp db/dumps/rxwatch-*.sql prod:/path/to/rxwatch/db/dumps/

# On production
yarn db:push               # Ensure schema exists
yarn db:restore db/dumps/rxwatch-YYYYMMDD.sql
```

**Step 5: Production cron jobs**
- DSC poll: Every 15 min (active/anticipated reports only)
- DPD sync: Daily 4am EST (smart change detection, skips if unchanged)

### Scripts

**scripts/fetch-history.ts** - Fetch and save raw API data (one-time)
```
1. Authenticate with DSC API
2. Paginate through ALL reports (~27k)
3. Save raw JSON responses to history/ folder as monthly chunks
   - history/2024-01.json, history/2024-02.json, etc.
   - Keeps individual files under GitHub's 100MB limit
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

`scripts/sync-dsc.ts` (runs every 15 min via systemd timer):

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

- **2 languages in MVP:** EN/FR only (add others if demand appears)
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
yarn db:start                  # Start PostgreSQL container (creates volume if needed)
yarn db:stop                   # Stop container
yarn db:push                   # Push schema to database
yarn db:generate               # Generate Drizzle migrations
yarn db:studio                 # Open Drizzle Studio (admin UI)
yarn db:dump                   # Create timestamped SQL dump
yarn db:restore <file>         # Restore from SQL dump
yarn db:reset                  # Nuclear: wipe volume, restart fresh

# Local Development
yarn dev                       # Next.js dev server (port 5000)

# Type check
yarn type-check

# Build
yarn build

# Data Sync Scripts
yarn fetch-history             # Fetch all DSC reports → history/ folder (one-time)
yarn backfill                  # Import history/ → database (DSC reports + drugs)
yarn sync-dpd                  # Daily DPD sync with smart change detection
yarn sync-dpd:backfill         # Full DPD catalog import (one-time, ~1-2 hours)
yarn sync-dpd --force          # Force full DPD sync (bypass change detection)
yarn sync-dsc                  # Sync DSC shortage reports (production: every 15 min)

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
│   ├── [locale]/                  # i18n routes (en/fr)
│   │   ├── page.tsx               # Homepage (stats + recent reports)
│   │   ├── drugs/
│   │   │   ├── page.tsx           # AG Grid - drugs with active reports
│   │   │   └── [din]/page.tsx     # Drug detail + alternatives
│   │   ├── reports/
│   │   │   ├── page.tsx           # AG Grid - all reports
│   │   │   └── [reportId]/page.tsx # Report detail
│   │   ├── stats/page.tsx         # Insights & analytics
│   │   ├── about/page.tsx         # About page
│   │   └── layout.tsx             # Global layout with search
│   └── api/                       # API routes
├── components/
│   ├── ui/                        # shadcn/ui components (auto-generated)
│   ├── GlobalSearch.tsx
│   ├── DrugGrid.tsx               # AG Grid for /drugs
│   ├── ReportGrid.tsx             # AG Grid for /reports
│   ├── DrugDetail.tsx
│   ├── ReportDetail.tsx
│   ├── ReportTimeline.tsx
│   ├── AlternativesList.tsx
│   ├── RecentReports.tsx
│   ├── StatsCharts.tsx            # Recharts for /stats page
│   └── DataFreshness.tsx          # "Last synced: X min ago"
├── db/
│   ├── schema.ts                  # Drizzle schema
│   ├── index.ts                   # Drizzle client
│   └── migrations/                # Generated migrations
├── lib/
│   ├── dsc-api.ts                 # Drug Shortages Canada client
│   ├── dpd-api.ts                 # Health Canada DPD client
│   └── alternatives.ts            # Alternative-finding logic
├── scripts/
│   ├── fetch-history.ts           # Fetch all DSC reports → history/ folder
│   ├── backfill.ts                # Import history/ → database
│   ├── sync-dsc.ts                # DSC sync (every 15 min)
│   ├── sync-dpd.ts                # DPD sync with change detection (daily)
│   └── analyze-apis.ts            # API field analysis (dev tool)
├── history/                       # Raw API responses (checked in, monthly chunks)
│   ├── 2024-01.json               # Reports from January 2024
│   ├── 2024-02.json               # etc.
│   └── ...
├── messages/
│   ├── en.json
│   └── fr.json
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
