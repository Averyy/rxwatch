# RxWatch.ca - Drug Shortage Intelligence Tool

## Project Overview

Canadian drug shortage lookup + notification tool. Combines data from Drug Shortages Canada API and Health Canada Drug Product Database to provide:
- Shortage status lookup by DIN, drug name, or barcode scan
- Alternative medication suggestions (same ingredient, different manufacturer/strength/form)
- DIN-based notifications when shortage status changes

## Web Research Workflow

When you need to read/fetch content from URLs:

**DO use:** `mcp__fetchaller__fetch` - no domain restrictions
**DO NOT use:** `WebFetch` - requires per-domain prompts, Reddit blocked

**Always use fetchaller for:**
- Any reddit.com URLs (posts, subreddits, user profiles)
- Any URL from WebSearch results
- Any web research task

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPS (Single Server)                │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Caddy     │    │  Next.js    │    │ PocketBase │  │
│  │   :80/:443  │───▶│   :3000     │───▶│   :8090    │  │
│  └─────────────┘    └─────────────┘    └────────────┘  │
│                                                         │
│  ┌─────────────────────────────────┐                    │
│  │  Cron Worker (every 15 min)     │                    │
│  │  scripts/poll-shortages.ts      │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Next.js 14** (App Router) - frontend + API routes
- **PocketBase** - database, auth, admin UI (self-hosted)
- **Resend** - transactional email
- **next-intl** - i18n (EN/FR/ZH-Hans/ZH-Hant/ES)
- **quagga2** or **html5-qrcode** - barcode scanning

---

## Data Sources

### Drug Shortages Canada API
- Base URL: `https://www.drugshortagescanada.ca/api/v1`
- Auth: Free account required (email verification)
- Rate Limit: 1000 requests/hour
- **Response time: SLOW (use 30s+ timeout)** - another reason for local caching
- Key endpoints:
  - `POST /login` - get auth token
  - `GET /search?term=X` - search shortages
  - `GET /shortages/{id}` - shortage details
  - `GET /discontinuances/{id}` - discontinuance details

**Baseline data (as of Jan 2026):**
| Type | Total | Active |
|------|-------|--------|
| Shortage reports | ~24,500 | ~1,700 actual + ~30 anticipated |
| Discontinuation reports | ~3,200 | ~150 to-be-discontinued |
| Resolved/historical | ~22,000 | (catalog only, no alerts) |

After initial backfill, ongoing polling only covers ~1,900 active records.

### Health Canada Drug Product Database API
- Base URL: `https://health-products.canada.ca/api/drug/`
- Auth: None required
- Key endpoints:
  - `/drugproduct/?din=X` - lookup by DIN
  - `/drugproduct/?brandname=X` - search by brand
  - `/activeingredient/?id=X` - ingredients for a drug
  - `/therapeuticclass/?id=X` - ATC codes
  - `/company/?id=X` - manufacturer info

---

## Notification Philosophy

- **Public feed:** Our homepage shows recent updates from our own database (populated via API polling) - no login required
- **Personal notifications:** Only sent if user explicitly added that DIN to their watchlist
- No spam, no "you might be interested in" - only exact DIN matches
- All data comes from official APIs only - no scraping

---

## PocketBase Collections

### `drugs` — The Catalog (one row per medication)
```
├── din (text, unique, indexed) ............ Primary lookup key
├── brand_name (text) ...................... "Metformin 500mg"
├── brand_name_fr (text) ................... French name
├── active_ingredient (text, indexed) ...... For same-ingredient alternatives
├── strength (text) ........................ "500mg"
├── strength_unit (text) ................... "mg"
├── form (text) ............................ "tablet"
├── route (text) ........................... "oral"
├── atc_code (text, indexed) ............... For therapeutic alternatives (ATC-4)
├── company (text) ......................... Manufacturer
├── dpd_id (text) .......................... Health Canada's internal ID
├── current_status (select) ................ Computed: available/in_shortage/anticipated/discontinued
└── active_report (relation → reports) ..... Current active report (if any)
```

### `reports` — The Events (one row per shortage/discontinuation)
```
├── report_id (text, unique) ............... From Drug Shortages Canada API
├── din (text, indexed) .................... Links to drugs table
├── type (select) .......................... shortage | discontinuation
├── status (select) ........................ See mapping below
├── reason (text) .......................... "Manufacturing delay"
├── expected_end_date (date) ............... When shortage expected to resolve
├── actual_end_date (date) ................. When it actually resolved
├── company (text) ......................... Reporting company
├── updated_at (date, indexed) ............. For change detection + recent feed
└── raw_json (json) ........................ Full API response for debugging
```

**Status mapping (API → our DB):**
| API Value | Our Value | Meaning |
|-----------|-----------|---------|
| active_confirmed | active | Currently in shortage |
| anticipated_shortage | anticipated | Shortage expected soon |
| resolved | resolved | No longer in shortage |
| avoided_shortage | avoided | Was anticipated, didn't happen |
| discontinued | discontinued | Permanently removed |
| to_be_discontinued | to_be_discontinued | Will be removed |
| reversed | reversed | Was going to be discontinued, isn't |

### `users` (PocketBase built-in, extended)
```
├── email (required)
├── phone (text, optional) ................. For SMS notifications (Phase 2)
├── language (select: en/fr) ............... UI + notification language
├── notification_email (bool) .............. Receive email alerts
└── notification_sms (bool) ................ Receive SMS alerts (Phase 2)
```

### `watchlist` — User subscriptions
```
├── user (relation → users)
├── din (text, indexed) .................... The drug they're watching
├── notify_enabled (bool) .................. Can pause without deleting
└── created (auto)
```

### `notifications` — Audit log of sent notifications
```
├── user (relation → users)
├── report (relation → reports)
├── din (text)
├── type (select) .......................... new_shortage | status_change | resolved | discontinued
├── channel (select: email/sms)
└── sent_at (date)
```

### Key Indexes
| Collection | Field | Purpose |
|------------|-------|---------|
| drugs | din | Primary drug lookup |
| drugs | active_ingredient | Find same-ingredient alternatives |
| drugs | atc_code | Find therapeutic alternatives |
| reports | din | Find all reports for a drug |
| reports | updated_at | Recent updates feed + change detection |
| watchlist | din | Find users watching a drug |

---

## Environment Variables

```bash
# PocketBase
POCKETBASE_URL=http://localhost:8090

# Drug Shortages Canada API (multiple accounts for failover)
DSC_API_URL=https://www.drugshortagescanada.ca/api/v1
DSC_ACCOUNTS='[{"email":"account1@email.com","password":"pass1"},{"email":"account2@email.com","password":"pass2"}]'

# Health Canada DPD API (no auth needed)
DPD_API_URL=https://health-products.canada.ca/api/drug

# Resend (outbound notifications)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@rxwatch.ca  # or alerts@rxwatch.ca - configure in Resend

# Inbound email: info@rxwatch.ca (for support/contact form)

# App
NEXT_PUBLIC_APP_URL=https://rxwatch.ca

# Cron security (prevents unauthorized calls to /api/cron/poll)
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

### Backups
PocketBase stores everything in `pb_data/`. Back up this directory:
```bash
# Cron daily backup (add to crontab)
0 3 * * * tar -czf /backups/pb-$(date +\%Y\%m\%d).tar.gz /path/to/pocketbase/pb_data
```

### Monitoring
- Cron worker should log to a file or stdout (journald captures it)
- Set up a simple health check endpoint `/api/health`
- Consider uptime monitoring (UptimeRobot, Healthchecks.io - both have free tiers)

### Legal Disclaimers (Required)
Every page showing drug info must include:
- "This is not medical advice"
- "Always consult your pharmacist or doctor before making changes"
- "Alternative suggestions require verification by a healthcare professional"

---

## Next.js API Routes

```
app/api/
├── search/
│   └── route.ts          # GET ?q=metformin - search shortages + drug products
├── shortage/
│   └── [din]/route.ts    # GET - shortage status for specific DIN
├── alternatives/
│   └── [din]/route.ts    # GET - find alternatives for a drug
├── watchlist/
│   ├── route.ts          # GET (list), POST (add)
│   └── [id]/route.ts     # DELETE (remove)
├── auth/
│   ├── login/route.ts    # POST - PocketBase auth
│   ├── register/route.ts # POST - create account
│   └── logout/route.ts   # POST - clear session
└── cron/
    └── poll/route.ts     # POST - called by cron to poll for updates (secured)
```

---

## Data Population Strategy

### Initial Backfill (one-time)
```
scripts/backfill.ts
1. Fetch ALL shortage/discontinuation reports from Drug Shortages Canada API
   - Paginate through entire dataset (~27k reports)
   - Insert each into `reports` collection
2. For each unique DIN in reports:
   - Fetch drug details from Health Canada DPD API
   - Insert into `drugs` collection with current_status computed
3. Log stats: X drugs, Y reports imported
```

### Ongoing Sync
- **Reports:** Cron polls every 15 min, updates changed records
- **Drugs:** When we see a new DIN in a report, fetch from DPD API on-demand
- **DPD refresh:** Optional weekly job to update drug details (ingredients rarely change)

---

## Cron Worker Logic

`scripts/poll-shortages.ts` (runs every 15 min via systemd timer):

```
1. Try to authenticate with Drug Shortages Canada API
   - Parse DSC_ACCOUNTS JSON array
   - Try first account; if 401/403/429, try next account
   - Log which account succeeded (for monitoring)
   - If all accounts fail, alert and abort
2. Fetch all active/anticipated shortages (paginated)
3. For each shortage/discontinuation from API:
   a. Check if report_id exists in our `reports` collection
   b. If new report → insert into `reports` + update `drugs.current_status` + find watchers → queue notifications
   c. If exists but changed (status, end_date) → update `reports` + update `drugs.current_status` + queue notifications
   d. If was active but not in API response → mark resolved + update `drugs.current_status` + queue notifications
4. Send queued notifications via Resend
5. Log results
```

**API Key Rotation Strategy:**
- Register 2-3 accounts with different emails
- Store as JSON array in `DSC_ACCOUNTS` env var
- Cron tries accounts in order until one works
- If account gets rate-limited (429), automatically try next
- If account gets blocked (401/403), log warning + try next
- Rotate "primary" account weekly to spread usage

---

## Key Decisions

- **5 languages in MVP:** EN, FR, Simplified Chinese, Traditional Chinese, Spanish
- Barcode scanning in MVP (camera API, works on mobile)
- Therapeutic alternatives limited to same ATC-4 level with "consult doctor" warning
- Patients first, pharmacists second
- Local DB cache of shortage data, poll API for updates only
- PocketBase runs on localhost:8090, not exposed publicly

## i18n Strategy

**Translated (UI strings):**
- Navigation, buttons, labels
- Status messages ("In Shortage", "Resolved")
- Instructions and disclaimers
- Notification emails

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
# Local Development
yarn dev              # Next.js dev server
./pocketbase serve    # PocketBase (separate terminal)

# Type check
yarn type-check

# Build
yarn build

# Production (on VPS)
pm2 start ecosystem.config.js   # Starts both Next.js + PocketBase
```

---

## Local Development Setup

1. Download PocketBase binary for your OS from https://pocketbase.io/docs/
2. Run `./pocketbase serve` - creates admin at http://localhost:8090/_/
3. Create collections via admin UI (or import schema)
4. Copy `.env.example` to `.env.local` and fill in values
5. Run `yarn dev`
6. Register for Drug Shortages Canada API account at https://www.drugshortagescanada.ca/

---

## File Structure

```
drug-shortage-tool/
├── app/
│   ├── [locale]/           # i18n routes (en/fr)
│   │   ├── page.tsx        # Home/search
│   │   ├── drug/[din]/     # Drug detail + alternatives
│   │   ├── watchlist/      # User's watchlist
│   │   └── layout.tsx
│   └── api/                # API routes
├── components/
│   ├── SearchBar.tsx
│   ├── ShortageCard.tsx
│   ├── AlternativesList.tsx
│   ├── BarcodeScanner.tsx
│   └── WatchlistButton.tsx
├── lib/
│   ├── pocketbase.ts       # PocketBase client
│   ├── dsc-api.ts          # Drug Shortages Canada client
│   ├── dpd-api.ts          # Health Canada DPD client
│   ├── alternatives.ts     # Alternative-finding logic
│   └── reason-mappings.ts  # Shortage reason translations (API value → i18n key)
├── scripts/
│   ├── backfill.ts         # One-time initial data import
│   └── poll-shortages.ts   # Cron worker (every 15 min)
├── messages/
│   ├── en.json             # English
│   ├── fr.json             # French
│   ├── zh-Hans.json        # Simplified Chinese (Mandarin)
│   ├── zh-Hant.json        # Traditional Chinese (Cantonese regions)
│   └── es.json             # Spanish
├── pocketbase/             # PocketBase data directory
│   └── pb_data/
├── CLAUDE.md
├── PLAN.md
└── package.json
```
