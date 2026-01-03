# RxWatch.ca

**Canadian Drug Shortage Intelligence Tool**

Watch your medications. Get alerted. Find alternatives.

## What is this?

RxWatch helps Canadians navigate drug shortages by combining data from official government sources:

- **Shortage Lookup** - Search by drug name, DIN, or barcode scan
- **Alternative Suggestions** - Find same-ingredient alternatives from different manufacturers
- **DIN-based Notifications** - Get alerted when YOUR specific medication's status changes

## Why RxWatch?

Canada has 1,500-2,000 active drug shortages at any given time. The official source ([DrugShortagesCanada.ca](https://www.drugshortagescanada.ca)) has the data but:

| Problem | RxWatch Solution |
|---------|------------------|
| **Slow** - API responses take 10-30+ seconds | **Fast** - Local cache, sub-second lookups |
| **ATC-based alerts** - Track drug classes (researcher-focused) | **DIN-based alerts** - Track YOUR specific medication (patient-focused) |
| **No alternatives** - Just raw shortage data | **Smart alternatives** - Same ingredient, different manufacturer |
| **Technical UI** - Built for public health analysts | **Simple UI** - Built for patients and pharmacists |

### Why DIN over ATC?

The official site uses [ATC codes](https://www.who.int/tools/atc-ddd-toolkit/atc-classification) (WHO drug classification) for notifications - great for researchers tracking "all diabetes drugs" but useless for patients.

RxWatch uses **DIN** (Drug Identification Number) - the 8-digit code on your medication bottle. One DIN = one specific product. When you add a DIN to your watchlist, you're tracking exactly what you take, not a broad category.

## Data Sources

| Source | Data |
|--------|------|
| [Drug Shortages Canada](https://www.drugshortagescanada.ca/) | Shortage reports, status, expected resolution dates |
| [Health Canada Drug Product Database](https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database.html) | Drug details, ingredients, manufacturers, ATC codes |

## Tech Stack

- Next.js 14 (App Router)
- PocketBase (database + auth)
- Resend (email notifications)
- next-intl (EN/FR/ZH-Hans/ZH-Hant/ES)

## Status

**Pre-MVP** - Active development

## Disclaimer

This tool is for informational purposes only. It is not medical advice. Always consult your pharmacist or doctor before making any changes to your medications. Alternative suggestions require verification by a healthcare professional.

## License

See [LICENSE](LICENSE) file.
