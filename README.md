# RxWatch Canada

**Canadian Drug Shortage Intelligence**

Track Canadian drug shortages and discontinuations in real-time. Search 57,000+ drugs, view shortage history, and find therapeutic alternatives using official Health Canada data.

## Why This Exists

The official [Drug Shortages Canada](https://www.drugshortagescanada.ca/) website is frequently slow, occasionally goes down, and can be difficult to navigate. RxWatch provides a faster, more reliable interface to the same official data with better search, filtering, and alternative medication suggestions.

## Features

- **Drug Search** - Search 57,000+ drugs by name or DIN with fuzzy matching (handles typos)
- **Shortage Reports** - Browse 27,000+ shortage and discontinuation reports with filtering
- **Alternatives** - Find same-ingredient generics or same-class therapeutic alternatives
- **Analytics** - Track trends, late reporters, and root causes
- **Bilingual** - Full English and French support
- **Real-time Sync** - Data updated every 15 minutes from official sources

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| [Drug Shortages Canada](https://www.drugshortagescanada.ca/) | Shortage reports, discontinuations, status updates | Every 15 min |
| [Health Canada DPD](https://health-products.canada.ca/api/documentation/dpd-documentation-en.html) | Drug catalog, ingredients, manufacturers, ATC codes | Daily |

## Tech Stack

- **Next.js 15** (App Router) + React 19
- **Tailwind CSS** + **shadcn/ui**
- **AG Grid** - Data tables
- **Recharts** - Charts
- **PostgreSQL** + Drizzle ORM
- **next-intl** - Internationalization (EN/FR)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Averyy/rxwatch.git
cd rxwatch
yarn install

# 2. Start PostgreSQL
docker compose up -d

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your DSC credentials (free account at drugshortagescanada.ca)

# 4. Set up database and load data
yarn db:push
yarn backfill              # Import historical reports from history/ folder
yarn sync-dpd:backfill     # Fetch full drug catalog (~1-2 hours)

# 5. Run dev server
yarn dev
```

The `history/` folder contains pre-fetched shortage reports, so `yarn backfill` is fast. The DPD sync takes longer as it fetches from Health Canada's API.

See [CLAUDE.md](CLAUDE.md) for detailed technical documentation.

## Production Deployment

Deploys automatically via GitHub Actions on push to `main`. The app includes built-in cron jobs for data sync - no external crontab needed.

**Architecture:**
```
Caddy (:80/:443) → Next.js (:5000) → PostgreSQL (:5432)
                        ↓
              Built-in cron (DSC: 15min, DPD: daily)
```

**GitHub Secrets required:**
- `VPS_HOST` - Server IP/hostname
- `VPS_USERNAME` - SSH user
- `VPS_SSH_KEY` - Private SSH key

**Caddy config:**
```
rxwatch.ca {
    reverse_proxy localhost:5000
}
```

## Disclaimer

This tool is for informational purposes only. **This is not medical advice.** Always consult your pharmacist or doctor before making any changes to your medications. Alternative suggestions require verification by a healthcare professional.

## License

MIT - See [LICENSE](LICENSE)
