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

Plus: **Get notified when anything changes for medications you care about.**

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

### MVP (Phase 1)

#### 1. Shortage Lookup
- Enter drug name, DIN, or scan barcode
- See: Is it in shortage? (Yes/No)
- See: Expected resolution date
- See: Severity tier (1/2/3)
- See: Reason for shortage

#### 2. Alternative Suggestions (THE MOAT)
Using Health Canada DPD data, automatically suggest:

**Same Drug, Different Source:**
- Different manufacturer (e.g., Teva vs Apotex)
- Different strength (e.g., 2x 25mg instead of 1x 50mg)
- Different form (e.g., liquid vs tablet)

**Therapeutic Alternatives:**
- Same ATC class (requires doctor approval)
- Ranked by: similarity, availability, common substitution patterns

#### 3. DIN Notification System
- Enter ANY DIN number
- Get notified when:
  - New shortage reported
  - Shortage status changes (anticipated → active → resolved)
  - Expected end date changes
  - New alternative becomes available
- Notification channels: Email, SMS, Push

#### 4. Watchlist
- Save multiple medications
- Dashboard showing status of all your meds
- One-click to see alternatives for any

---

### Phase 2 Features (Pharmacist Tools)

#### 5. Pharmacist Dashboard
- Bulk lookup (paste list of DIns)
- Print patient handouts explaining shortage + options
- Message templates for physicians
- Daily digest: "New shortages affecting your common dispensed drugs"

#### 6. Alternative Verification
- Link to official monographs
- Dosage equivalence calculator
- Provincial formulary coverage check

---

### Phase 3 Features (Enterprise)

#### 7. API Access
- Integrate shortage intelligence into pharmacy software
- EMR integration for prescribers
- Webhook notifications

#### 8. Analytics
- Shortage trends
- Predictive alerts (pattern detection)
- Regional availability differences

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

### Database Design

**Why two tables for drugs/reports?**
- `drugs` = stable catalog of medications (one row per DIN)
- `reports` = events that happen to medications (many per DIN over time)
- Enables efficient queries: "show 20 most recent updates" without scanning all drugs
- Standard normalized design, indexed for performance

### PocketBase Collections

**`drugs`** — The Catalog (one row per medication)
```
din (unique, indexed)         → Primary lookup key
brand_name                    → "Metformin 500mg"
brand_name_fr                 → French name
active_ingredient (indexed)   → For same-ingredient alternatives
strength, strength_unit       → "500", "mg"
form, route                   → "tablet", "oral"
atc_code (indexed)            → For therapeutic alternatives (ATC-4 level)
company                       → Manufacturer
dpd_id                        → Health Canada's internal ID
current_status                → Computed: available | in_shortage | anticipated | discontinued
active_report                 → Relation to current active report (if any)
```

**`reports`** — The Events (one row per shortage/discontinuation)
```
report_id (unique)            → From Drug Shortages Canada API
din (indexed)                 → Links to drugs table
type                          → shortage | discontinuation
status                        → active | anticipated | resolved | avoided | discontinued | reversed
reason                        → "Manufacturing delay"
expected_end_date             → When shortage expected to resolve
actual_end_date               → When it actually resolved
company                       → Reporting company
updated_at (indexed)          → For change detection + recent feed
raw_json                      → Full API response
```

**`users`** (PocketBase built-in, extended)
```
email, phone, language (en/fr)
notification_email, notification_sms (bools)
```

**`watchlist`** — User subscriptions
```
user (relation), din (indexed), notify_enabled, created
```

**`notifications`** — Audit log
```
user, report (relation), din, type, channel, sent_at
```

### Key Indexes
| Collection | Field | Purpose |
|------------|-------|---------|
| drugs | din | Primary drug lookup |
| drugs | active_ingredient | Same-ingredient alternatives |
| drugs | atc_code | Therapeutic alternatives |
| reports | din | Find all reports for a drug |
| reports | updated_at | Recent feed + change detection |
| watchlist | din | Find users watching a drug |

### Notification System Design

**Polling Strategy:**
- Cron job every 15-30 minutes
- Fetch all active/anticipated shortages from API
- Compare to previous state in cache
- Detect changes:
  - New shortage (DIN not previously in shortage)
  - Status change (anticipated → active, active → resolved)
  - End date change
  - Tier change
- For each change, find users watching that DIN
- Queue notifications

**Rate Limit Consideration:**
- 1000 requests/hour = ~16/minute
- Batch requests efficiently
- Cache aggressively (shortages don't change every second)

---

## Tech Stack

- **Frontend:** Next.js (React)
- **Backend:** Next.js API routes
- **Database:** PocketBase (SQLite + auth + admin UI)
- **Notifications:**
  - Email: Resend
  - SMS: Twilio (Phase 2)
  - Push: Web Push API (Phase 2)
- **Cron/Jobs:** systemd timer or cron on VPS
- **Hosting:** Self-hosted VPS (Next.js + PocketBase)

---

## MVP Scope (What to Build First)

### Week 1-2: Core Search
- [ ] Shortage lookup by drug name/DIN
- [ ] Display shortage status + details
- [ ] Basic alternative suggestions (same ingredient, different manufacturer)

### Week 3-4: Notifications MVP
- [ ] User accounts (email/password or magic link)
- [ ] Add DIN to watchlist
- [ ] Email notifications on shortage changes
- [ ] Basic watchlist dashboard

### Week 5-6: Polish + Launch
- [ ] Mobile-responsive design
- [ ] All 5 languages (EN/FR/ZH-Hans/ZH-Hant/ES) - UI only
- [ ] Landing page + SEO
- [ ] Patient-friendly language throughout
- [ ] "Verify with your pharmacist" disclaimers

---

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| Free (Patients) | $0 | Lookup, 5 watchlist items, email notifications |
| Plus | $5/mo | Unlimited watchlist, SMS notifications, no ads |
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
- 1,000 registered users
- 5,000 watchlist items
- 500 notifications sent
- <5% unsubscribe rate

### Growth (12 months)
- 10,000 registered users
- 50 paying pharmacy accounts
- 1 provincial pilot
- Press coverage

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Therapeutic alternatives | ATC-4 level only | Safe boundary, always show "consult doctor" warning |
| Barcode scanning | Yes, in MVP | Key UX differentiator for patients at pharmacy |
| Language | 5 languages: EN, FR, Simplified Chinese, Traditional Chinese, Spanish | Canadian market + immigrant communities (UI only, not drug names) |
| Target audience priority | Patients first, pharmacists second | Build free user base, monetize B2B later |
| Hosting | Self-hosted VPS | Full control, cost-effective, no vendor lock-in |
| Database | PocketBase | Single binary, built-in auth, admin UI, SQLite |

## Pre-Launch Checklist

| Item | Status | Action |
|------|--------|--------|
| Name/Branding | ✅ | **RxWatch.ca** |
| Domain | ✅ | rxwatch.ca registered, pointed to VPS |
| Privacy Policy | ⬜ | PIPEDA-compliant policy (Canada) |
| Medical Disclaimers | ⬜ | "Not medical advice" language reviewed |

## Open Questions

1. **SMS costs:** At scale, SMS notifications get expensive. Worth it for Phase 2?

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VPS (Single Server)                │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   Caddy     │    │  Next.js    │    │ PocketBase │  │
│  │   :80/:443  │───▶│   :3000     │───▶│   :8090    │  │
│  │  (reverse   │    │  (frontend  │    │  (database │  │
│  │   proxy)    │    │  + API)     │    │  + auth)   │  │
│  └─────────────┘    └─────────────┘    └────────────┘  │
│                                               │         │
│  ┌─────────────────────────────────┐          │         │
│  │  Cron Worker (systemd timer)    │──────────┘         │
│  │  - Poll Drug Shortages API      │                    │
│  │  - Update reports + drugs       │                    │
│  │  - Trigger notifications        │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌─────────────────┐      ┌─────────────────────┐
   │ Drug Shortages  │      │ Health Canada DPD   │
   │ Canada API      │      │ API                 │
   └─────────────────┘      └─────────────────────┘
```

**Process Management:** PM2 or systemd keeps Next.js + PocketBase running

**Domain Setup:**
- `rxwatch.ca` → Next.js (public)
- PocketBase on `localhost:8090` only (internal, not exposed)

---

## Next Steps

1. ~~Validate API access~~ ✓ (both APIs confirmed working)
2. ~~Design notification system architecture~~ ✓
3. ~~Choose tech stack~~ ✓
4. Scaffold project (Next.js + PocketBase)
5. Build shortage lookup + display
6. Build alternative suggestions engine
7. Add user accounts + watchlist (PocketBase auth)
8. Implement cron worker for notifications
9. Add barcode scanning (camera API)
10. Add French translations (i18n)
11. Deploy to VPS
12. Launch beta
