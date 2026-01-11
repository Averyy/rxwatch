import { MetadataRoute } from 'next'
import { db } from '@/db'
import { drugs, reports } from '@/db/schema'
import { sql } from 'drizzle-orm'

// Force dynamic generation - sitemap needs live DB data
export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxwatch.ca'
const URLS_PER_SITEMAP = 40000 // Stay under 50k limit

// Static pages that don't change often
const staticPages = [
  { url: '', changeFrequency: 'daily' as const, priority: 1.0 },
  { url: '/drugs', changeFrequency: 'hourly' as const, priority: 0.9 },
  { url: '/reports', changeFrequency: 'hourly' as const, priority: 0.9 },
  { url: '/stats', changeFrequency: 'daily' as const, priority: 0.7 },
  { url: '/about', changeFrequency: 'monthly' as const, priority: 0.5 },
  { url: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
  { url: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
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
 * ID 0: Static pages
 * ID 1-N: Drugs (paginated)
 * ID N+1-M: Reports (paginated)
 */
export async function generateSitemaps() {
  const counts = await getCounts()

  const drugSitemaps = Math.ceil(counts.drugs / URLS_PER_SITEMAP)
  const reportSitemaps = Math.ceil(counts.reports / URLS_PER_SITEMAP)

  // ID 0 = static, 1-N = drugs, N+1-M = reports
  const totalSitemaps = 1 + drugSitemaps + reportSitemaps

  return Array.from({ length: totalSitemaps }, (_, i) => ({ id: i }))
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

  // ID 0: Static pages
  if (sitemapId === 0) {
    return staticPages.map((page) => ({
      url: `${baseUrl}${page.url}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }))
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

    return drugData.map((drug) => ({
      url: `${baseUrl}/drugs/${drug.din}`,
      lastModified: drug.updatedAt || new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
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

  return reportData.map((report) => ({
    url: `${baseUrl}/reports/${report.reportId}`,
    lastModified: report.updatedAt || new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))
}
