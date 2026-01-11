# RxWatch.ca - Drug Shortage Intelligence Tool

Canadian drug shortage lookup + notification tool. Combines Drug Shortages Canada API + Health Canada Drug Product Database for shortage status, alternatives, and push notifications (iOS).

## What's Not Built Yet
- [ ] DrugSearch autocomplete dropdown styling

## Database Stats
| Data | Count |
|------|-------|
| Drugs (DPD) | 57,512 |
| Reports (DSC) | 27,823 |
| Drugs with shortage history | 8,777 |

---

## Tool Selection

**DO NOT use `WebFetch`** - use fetchaller instead (no domain restrictions).

**shadcn MCP** - Use for all shadcn/ui operations. Before web searching, review: https://ui.shadcn.com/llms.txt

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPS (Single Server)                │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Caddy     │───▶│  Next.js    │───▶│ PostgreSQL │  │
│  │   :80/:443  │    │   :5000     │    │   :5433    │  │
│  └─────────────┘    └─────────────┘    └────────────┘  │
│                                                         │
│  Cron: scripts/sync-dsc.ts (15 min), sync-dpd.ts (daily)│
└─────────────────────────────────────────────────────────┘
```

**Tech Stack:** Next.js 15, React 19, Tailwind, shadcn/ui, AG Grid, Recharts, Drizzle ORM, PostgreSQL, next-intl (EN/FR)

---

## Data Sources

### Drug Shortages Canada API
- URL: `https://www.drugshortagescanada.ca/api/v1`
- Auth: Free account required, rate limit 1000/hr
- **Response time: SLOW (30s+ timeout)**
- Docs: https://www.drugshortagescanada.ca/blog/52

**Endpoints:** `POST /login`, `GET /search`, `GET /shortages/{id}`, `GET /discontinuances/{id}`

**Status Values:**
| Type | Statuses |
|------|----------|
| Shortage | `active_confirmed`, `anticipated_shortage`, `avoided_shortage`, `resolved` |
| Discontinuation | `to_be_discontinued`, `discontinued`, `reversed` |

### Health Canada DPD API
- URL: `https://health-products.canada.ca/api/drug/`
- Auth: None required
- Uses `drug_code` (integer) as internal ID, not DIN
- Docs: https://health-products.canada.ca/api/documentation/dpd-documentation-en.html

---

## Database Schema

See `db/schema.ts` for full schema. Key points:

**Enums:**
- `drugStatusEnum`: available, in_shortage, anticipated, discontinued, to_be_discontinued
- `reportTypeEnum`: shortage, discontinuation
- `reportStatusEnum`: active_confirmed, anticipated_shortage, avoided_shortage, resolved, to_be_discontinued, discontinued, reversed

**Tables:**
- `drugs` - 57k rows, one per DIN. Key fields: din, brandName, activeIngredient, atcCode, currentStatus, hasReports
- `reports` - 27k rows, many per DIN. Key fields: reportId, din, type, status, tier3, lateSubmission

**Search:** Uses pg_trgm + GIN indexes for fuzzy matching (handles typos like "metforman" → "metformin")

---

## API Routes

```
/api/search?q=             # Fuzzy search drugs
/api/drugs                 # List drugs (AG Grid)
/api/drugs/[din]           # Drug details + reports
/api/drugs/[din]/alternatives
/api/reports               # List reports (AG Grid)
/api/reports/[id]          # Report details
/api/stats                 # Aggregate stats
/api/health                # Health check
```

**GET /api/drugs params:** `hasReports`, `status`, `company`, `atc`, `ingredient`, `marketed`

**GET /api/reports params:** `active`, `type`, `status`, `company`, `din`, `tier3`, `late`, `since`

**Caching:** In-memory 15-min TTL (matches sync interval). See `lib/api-cache.ts`.

---

## Data Sync

| Source | Script | Frequency | Notes |
|--------|--------|-----------|-------|
| DSC | `sync-dsc.ts` | Every 15 min | Active reports, gap detection |
| DPD | `sync-dpd.ts` | Daily 4am | Smart change detection |

**Initial Setup (one-time):**
```bash
yarn fetch-history         # Fetch DSC reports → history/ folder
yarn backfill              # Import history → database
yarn sync-dpd:backfill     # Full DPD catalog (~1-2 hours)
yarn db:dump               # Save SQL dump
```

**DPD sync modes:**
- `yarn sync-dpd` - Daily incremental (skips if unchanged)
- `yarn sync-dpd:backfill` - Full catalog fetch
- `yarn sync-dpd:from-cache` - Reimport from local cache
- `yarn sync-dpd --force` - Force full sync

---

## Environment Variables

```bash
DATABASE_URL=postgresql://rxwatch:password@localhost:5433/rxwatch
DSC_API_URL=https://www.drugshortagescanada.ca/api/v1
DSC_ACCOUNTS='[{"email":"...","password":"..."}]'  # Multiple for failover
DPD_API_URL=https://health-products.canada.ca/api/drug
NEXT_PUBLIC_APP_URL=https://rxwatch.ca
```

---

## Commands

```bash
# Database
yarn db:start              # Start PostgreSQL container
yarn db:stop               # Stop container
yarn db:push               # Push schema
yarn db:dump               # Create SQL dump
yarn db:restore <file>     # Restore from dump
yarn db:reset              # Wipe and restart fresh
yarn db:studio             # Drizzle Studio

# Development
yarn dev                   # Dev server (port 5000)
yarn build                 # Production build
yarn type-check            # TypeScript check

# Data Sync
yarn fetch-history         # DSC reports → history/
yarn backfill              # history/ → database
yarn sync-dsc              # DSC sync (production cron)
yarn sync-dpd              # DPD sync (daily cron)
yarn sync-dpd:backfill     # Full DPD import
```

---

## Database Workflow

**Restore from dump (most common):**
```bash
yarn db:start && yarn db:push
yarn db:restore db/dumps/rxwatch-YYYYMMDD.sql
```

**Fresh backfill (rare):**
```bash
yarn db:reset && yarn db:push
yarn backfill && yarn sync-dpd:backfill
yarn db:dump  # Save it!
```

Dumps are gitignored. DSC API is slow - don't rebuild from scratch unnecessarily.

---

## Local Development Setup

1. `docker-compose up -d` - Start PostgreSQL
2. Copy `.env.example` → `.env.local`
3. `yarn db:push` - Create schema
4. `yarn db:restore <dump>` or `yarn backfill` - Load data
5. `yarn dev` - Start dev server

---

## Key Decisions

- EN/FR only for MVP
- Therapeutic alternatives limited to same ATC-4 level
- Notifications only via iOS app (free APNS)
- No web accounts in v1
- All data from official APIs only - no scraping

## Legal Disclaimers (Required)

Every page showing drug info must include:
- "This is not medical advice"
- "Always consult your pharmacist or doctor"
- "Alternative suggestions require verification by a healthcare professional"
