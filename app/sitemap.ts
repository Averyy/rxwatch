import { MetadataRoute } from 'next'
import { db } from '@/db'
import { drugs, reports } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { locales } from '@/i18n/config'

// Force dynamic generation - sitemap needs live DB data
export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxwatch.ca'
const URLS_PER_SITEMAP = 20000 // Reduced to accommodate both locales (2x URLs)

// Static pages that don't change often
const staticPages = [
  { path: '', changeFrequency: 'daily' as const, priority: 1.0 },
  { path: '/drugs', changeFrequency: 'hourly' as const, priority: 0.9 },
  { path: '/reports', changeFrequency: 'hourly' as const, priority: 0.9 },
  { path: '/stats', changeFrequency: 'daily' as const, priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly' as const, priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
]

async function getCounts() {
  try {
    const [drugCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(drugs)

    const [reportCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)

    return {
      drugs: drugCount?.count || 0,
      reports: reportCount?.count || 0,
    }
  } catch {
    // Database not available (e.g., during Docker build)
    return { drugs: 0, reports: 0 }
  }
}

/**
 * Generate sitemap IDs for all content
 * ID 0: Static pages (both locales)
 * ID 1-N: Drugs (paginated, both locales)
 * ID N+1-M: Reports (paginated, both locales)
 */
export async function generateSitemaps() {
  const counts = await getCounts()

  const drugSitemaps = Math.ceil(counts.drugs / URLS_PER_SITEMAP)
  const reportSitemaps = Math.ceil(counts.reports / URLS_PER_SITEMAP)

  // ID 0 = static, 1-N = drugs, N+1-M = reports
  const totalSitemaps = 1 + drugSitemaps + reportSitemaps

  return Array.from({ length: totalSitemaps }, (_, i) => ({ id: i }))
}

// Helper to create alternates for a path
function createAlternates(path: string) {
  return {
    languages: Object.fromEntries(
      locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`])
    ),
  }
}

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  // Ensure id is a number (Next.js may pass it as string from URL)
  const sitemapId = Number(id)
  const counts = await getCounts()
  const drugSitemaps = Math.ceil(counts.drugs / URLS_PER_SITEMAP)

  // ID 0: Static pages (generate for all locales)
  if (sitemapId === 0) {
    const urls: MetadataRoute.Sitemap = []

    for (const page of staticPages) {
      for (const locale of locales) {
        urls.push({
          url: `${baseUrl}/${locale}${page.path}`,
          lastModified: new Date(),
          changeFrequency: page.changeFrequency,
          priority: page.priority,
          alternates: createAlternates(page.path),
        })
      }
    }

    return urls
  }

  // IDs 1 to drugSitemaps: Drugs
  if (sitemapId >= 1 && sitemapId <= drugSitemaps) {
    const offset = (sitemapId - 1) * URLS_PER_SITEMAP
    const drugData = await db
      .select({
        din: drugs.din,
        updatedAt: drugs.updatedAt,
      })
      .from(drugs)
      .orderBy(drugs.din)
      .limit(URLS_PER_SITEMAP)
      .offset(offset)

    const urls: MetadataRoute.Sitemap = []

    for (const drug of drugData) {
      const path = `/drugs/${drug.din}`
      for (const locale of locales) {
        urls.push({
          url: `${baseUrl}/${locale}${path}`,
          lastModified: drug.updatedAt || new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.8,
          alternates: createAlternates(path),
        })
      }
    }

    return urls
  }

  // Remaining IDs: Reports
  const reportSitemapIndex = sitemapId - drugSitemaps - 1
  const offset = reportSitemapIndex * URLS_PER_SITEMAP
  const reportData = await db
    .select({
      reportId: reports.reportId,
      updatedAt: reports.updatedAt,
    })
    .from(reports)
    .orderBy(reports.reportId)
    .limit(URLS_PER_SITEMAP)
    .offset(offset)

  const urls: MetadataRoute.Sitemap = []

  for (const report of reportData) {
    const path = `/reports/${report.reportId}`
    for (const locale of locales) {
      urls.push({
        url: `${baseUrl}/${locale}${path}`,
        lastModified: report.updatedAt || new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
        alternates: createAlternates(path),
      })
    }
  }

  return urls
}
