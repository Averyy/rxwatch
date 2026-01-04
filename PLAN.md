# RxWatch.ca

**Canadian Drug Shortage Intelligence Tool**

*Watch your medications. Get alerted. Find alternatives.*

---

## The Problem

1. **1,500-2,000 active drug shortages** in Canada at any time
2. **Patients** arrive at pharmacy confused when their medication isn't available
3. **Pharmacists** spend 30+ min/shift on shortage management using ad-hoc methods
4. **DrugShortagesCanada.ca** exists but is:
   - Not user-friendly (government-acknowledged)
   - No alternative suggestions
   - No personalized notifications
   - Raw data, no intelligence layer

---

## The Solution

A simple tool that answers: **"My medication isn't available — what are my options?"**

Plus: **Get push notifications via iOS app when anything changes for medications you care about.**

---

## Target Users

### Phase 1: Patients (Free)
- Person who shows up at pharmacy and is told their med is unavailable
- Caregiver managing medications for family member
- Chronic condition patient who wants to stay ahead of shortages

### Phase 2: Pharmacists (Paid)
- Community pharmacists drowning in shortage calls
- Pharmacy technicians doing the legwork
- Independent pharmacy owners

### Phase 3: Healthcare System (Enterprise)
- Hospital pharmacy departments
- Provincial health ministries
- EMR integrations

---

## Core Features

### Web (v1) - Public Lookup

#### Pages Structure

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
└── ~10,000 rows (active or historical)

/drugs/[din]                Drug detail page
├── Drug info + current status
├── All reports for this DIN (timeline)
└── Alternatives section

/reports                    AG Grid - all reports
├── Columns: TBD
├── Filters: TBD
├── Click row → /reports/[reportId]
└── 27,819 rows (virtualized)

/reports/[reportId]         Report detail page
├── Full report info
├── Link to drug → /drugs/[din]
└── Raw API data (collapsible)

/stats                      Insights & Analytics
├── Shortage trends over time (line chart)
├── Active shortages by drug category (ATC level 2/3)
├── Tier 3 critical shortages (current + historical)
├── Late reporting rate by company (accountability)
│   └── Top 10 companies by % of reports submitted late
├── Average shortage duration by category
└── Data freshness indicator

/about                      Static page
```

#### Alternative Suggestions (THE MOAT)
Using Health Canada DPD data, automatically suggest:

**Same Drug, Different Source:**
- Different manufacturer (e.g., Teva vs Apotex)
- Different strength (e.g., 2x 25mg instead of 1x 50mg)
- Different form (e.g., liquid vs tablet)

**Therapeutic Alternatives:**
- Same ATC class (requires doctor approval)
- Ranked by: similarity, availability, common substitution patterns

---

### iOS App - Watchlist + Notifications

#### 4. Watchlist
- Sign in with Apple
- Save multiple medications
- Dashboard showing status of all your meds
- One-click to see alternatives for any

#### 5. Push Notifications (FREE)
- Get notified when:
  - New shortage reported
  - Shortage status changes (anticipated → active → resolved)
  - Expected end date changes
  - Shortage resolved (good news!)
- All notifications are free (Apple handles infrastructure)

#### 6. Barcode Scanning
- Scan medication barcode with camera
- Instant lookup

---

### Phase 2 Features (Pharmacist Tools)

#### 7. Pharmacist Dashboard
- Bulk lookup (paste list of DIns)
- Print patient handouts explaining shortage + options
- Message templates for physicians
- Daily digest: "New shortages affecting your common dispensed drugs"

#### 8. Alternative Verification
- Link to official monographs
- Dosage equivalence calculator
- Provincial formulary coverage check

---

## Data Architecture

### Data Sources (All Free)

| Source | What We Get | Update Frequency |
|--------|-------------|------------------|
| Drug Shortages Canada API | Shortage reports, status, dates, reasons | Real-time (1000 req/hr) |
| Health Canada DPD API | Drug info, ATC codes, ingredients, forms, manufacturers | Daily refresh |

### Our Intelligence Layer

```
[Shortage Data] + [Drug Product Data] + [AI/Rules Engine]
                         ↓
            "Here are your alternatives"
```

**Matching Logic:**
1. Same active ingredient + different manufacturer
2. Same active ingredient + different strength (calculate equivalence)
3. Same active ingredient + different form
4. Same ATC code level 4 (therapeutic alternatives)
5. Same ATC code level 3 (broader alternatives, flag as "ask doctor")

### Database Design (PostgreSQL + Drizzle)

**Web (v1) - Just two tables:**
- `drugs` = stable catalog of medications (one row per DIN)
- `reports` = events that happen to medications (many per DIN over time)

**iOS App - Add user tables:**
- `users` = Apple Sign-In users
- `watchlist` = user → drug subscriptions
- `device_tokens` = for push notifications

See `CLAUDE.md` for full Drizzle schema.

---

## Tech Stack

### Web (v1)
| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 15 + React 19 | App Router, SSR |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, component library |
| Animations | Framer Motion | Subtle, professional motion |
| Data Grid | AG Grid Community | Interactive tables (/drugs, /reports) |
| Charts | Recharts (via shadcn/ui) | Stats visualizations (/stats) |
| Database | PostgreSQL (Docker) | Reliable, scalable |
| ORM | Drizzle | Type-safe, fast |
| i18n | next-intl | EN/FR (MVP) |
| Hosting | VPS + Caddy | Self-hosted |

### iOS App
| Component | Technology | Purpose |
|-----------|------------|---------|
| App | SwiftUI | Native iOS |
| Auth | Apple Sign-In | Simple, trusted |
| Push | APNS | Free notifications |
| Barcode | AVFoundation | Native camera |

---

## MVP Scope (What to Build First)

### Week 1-2: Core Search (Web)
- [ ] Shortage lookup by drug name/DIN
- [ ] Display shortage status + details
- [ ] Basic alternative suggestions (same ingredient, different manufacturer)
- [ ] Recent updates feed

### Week 3-4: Polish + Launch (Web)
- [ ] Mobile-responsive design
- [ ] EN/FR translations (UI only)
- [ ] Landing page + SEO
- [ ] Patient-friendly language throughout
- [ ] "Verify with your pharmacist" disclaimers
- [ ] /stats page with insights

### Week 5-6: iOS App
- [ ] SwiftUI app structure
- [ ] Apple Sign-In
- [ ] Watchlist + push notifications
- [ ] Barcode scanning

---

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| Free (Web) | $0 | Lookup, alternatives, feed |
| Free (iOS) | $0 | Watchlist, push notifications |
| Pharmacy | $49/mo | Dashboard, bulk lookup, print handouts, API access |
| Enterprise | Custom | EMR integration, analytics, SLA |

---

## Go-to-Market

### Phase 1: Build Awareness (Free Patient Tool)
- SEO: "is [drug name] in shortage canada"
- Reddit: r/canada, r/pharmacy, r/ChronicIllness
- Partner with patient advocacy groups (Diabetes Canada, Heart & Stroke)
- Press: Pitch to CBC Health, Globe & Mail (drug shortages are newsworthy)

### Phase 2: Pharmacy Sales
- Direct outreach to independent pharmacies
- Partner with pharmacy buying groups
- Exhibit at pharmacy conferences (CPhA)

### Phase 3: Health System
- Provincial health ministry pilots
- EMR vendor partnerships

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Liability if alternative causes harm | Clear disclaimers: "Always consult your pharmacist/doctor", not medical advice |
| Drug Shortages API changes/dies | Build relationship with Health Canada, offer to help improve |
| API account gets blocked/rate-limited | Multiple accounts registered, automatic failover in cron worker |
| Pharmacists don't pay | Prove ROI (time saved), generous free tier to build habit |
| DPD data quality issues | Manual review of alternative suggestions, user feedback loop |
| Competition emerges | Move fast, build community, focus on UX they won't prioritize |

---

## Success Metrics

### MVP Success (3 months)
- 1,000 web users (monthly)
- 500 iOS app downloads
- 2,000 watchlist items
- 500 push notifications sent
- Press coverage

### Growth (12 months)
- 10,000 web users (monthly)
- 5,000 iOS app users
- 50 paying pharmacy accounts
- 1 provincial pilot

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Therapeutic alternatives | ATC-4 level only | Safe boundary, always show "consult doctor" warning |
| Language | EN/FR only (MVP) | Ship fast, add others if demand appears |
| Target audience priority | Patients first, pharmacists second | Build free user base, monetize B2B later |
| Hosting | Self-hosted VPS | Full control, cost-effective, no vendor lock-in |
| Database | PostgreSQL + Drizzle | Type-safe, reliable, industry standard |
| Web auth | None (v1) | Keep it simple, no accounts needed for lookup |
| Notifications | iOS app only | Push notifications are free, Apple handles auth |
| Barcode | iOS app only | Native camera API works better |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPS (Single Server)                │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Caddy     │    │  Next.js    │    │ PostgreSQL │  │
│  │   :80/:443  │───▶│   :5000     │───▶│   :5433    │  │
│  │  (reverse   │    │  (frontend  │    │  (Docker)  │  │
│  │   proxy)    │    │  + API)     │    │            │  │
│  └─────────────┘    └──────┬──────┘    └────────────┘  │
│                            │                            │
│                     ┌──────┴──────┐                     │
│                     │ Drizzle ORM │                     │
│                     └─────────────┘                     │
│                                                         │
│  ┌─────────────────────────────────┐                    │
│  │  Cron Worker (systemd timer)    │                    │
│  │  - Poll Drug Shortages API      │                    │
│  │  - Update reports + drugs       │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌──────────────┐          ┌─────────────────┐
   │ Drug         │          │ Health Canada   │
   │ Shortages    │          │ DPD API         │
   │ Canada API   │          │                 │
   └──────────────┘          └─────────────────┘
```

**Process Management:** PM2 or systemd keeps Next.js running

**Domain Setup:**
- `rxwatch.ca` → Next.js (public)
- PostgreSQL on `localhost:5433` only (internal, not exposed)

---

## Pre-Launch Checklist

| Item | Status | Action |
|------|--------|--------|
| Name/Branding | Ready | **RxWatch.ca** |
| Domain | Ready | rxwatch.ca registered, pointed to VPS |
| Privacy Policy | ⬜ | PIPEDA-compliant policy (Canada) |
| Medical Disclaimers | ⬜ | "Not medical advice" language reviewed |
| Apple Developer Account | ⬜ | For iOS app + push notifications |

---

## Next Steps

1. ~~Validate API access~~ (both APIs confirmed working)
2. ~~Design notification system architecture~~
3. ~~Choose tech stack~~ (Next.js 15, Drizzle, PostgreSQL)
4. ~~Set up project scaffolding~~
   - [x] Docker + PostgreSQL
   - [x] Drizzle schema
   - [ ] Next.js app structure
5. Fetch historical data (scripts/fetch-history.ts)
6. Backfill database (scripts/backfill.ts)
7. Build shortage lookup + display
8. Build alternative suggestions engine
9. Add recent updates feed
10. Add /stats page with insights
11. Add translations (EN/FR)
12. Deploy to VPS
13. Launch web beta
14. Build iOS app (SwiftUI)
15. Submit to App Store
