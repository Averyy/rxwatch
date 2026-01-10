# RxWatch Canada

**Canadian Drug Shortage Intelligence**

Check Canadian drug shortages and discontinuations by name or DIN. View reports and find medication alternatives.

## Why This Exists

This is a free, open-source project to make Canadian drug shortage data more accessible. The official [Drug Shortages Canada](https://www.drugshortagescanada.ca/) website is frequently slow, occasionally goes down, and can be difficult to navigate. RxWatch provides a faster, more reliable interface to the same official data with better search, filtering, and alternative medication suggestions.

## Features

- **Drug Search** - Search 57,000+ drugs by name or DIN with fuzzy matching
- **Shortage Reports** - Browse 27,000+ shortage and discontinuation reports
- **Alternatives** - Find same-ingredient generics or same-class therapeutics
- **Analytics** - Track trends, late reporters, root causes
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

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Averyy/rxwatch.git
cd rxwatch
yarn install

# 2. Start PostgreSQL
docker compose up -d

# 3. Copy environment file
cp .env.example .env.local
# Edit .env.local with your DSC credentials (free account at drugshortagescanada.ca)

# 4. Set up database
yarn db:push
yarn db:restore db/dumps/rxwatch-latest.sql  # If you have a dump
# OR run full backfill (slow - DSC API is rate-limited):
# yarn backfill && yarn sync-dpd:backfill

# 5. Run dev server
yarn dev
```

See [CLAUDE.md](CLAUDE.md) for detailed technical documentation.

## Production Deployment (VPS)

Deploys automatically via GitHub Actions on push to `main`.

**One-time VPS setup:**
```bash
# Clone repo
git clone https://github.com/Averyy/rxwatch.git
cd rxwatch

# Configure environment
cp .env.example .env.local
# Edit .env.local with production credentials

# Set up cron jobs
crontab -e
# Add:
# 0,15,30,45 * * * * cd /root/rxwatch && yarn sync-dsc >> /var/log/rxwatch-dsc.log 2>&1
# 0 4 * * * cd /root/rxwatch && yarn sync-dpd >> /var/log/rxwatch-dpd.log 2>&1
```

Add to your Caddy config:
```
rxwatch.ca {
    reverse_proxy localhost:5000
}
```

Then push to `main` - GitHub Actions handles the rest (including first-run database seeding from cached data).

**GitHub Secrets required:**
- `VPS_HOST` - Server IP/hostname
- `VPS_USERNAME` - SSH user
- `VPS_SSH_KEY` - Private SSH key

## Disclaimer

This tool is for informational purposes only. **This is not medical advice.** Always consult your pharmacist or doctor before making any changes to your medications. Alternative suggestions require verification by a healthcare professional.

## License

MIT - See [LICENSE](LICENSE)
