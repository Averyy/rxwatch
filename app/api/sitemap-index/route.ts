import { db } from '@/db'
import { drugs, reports } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxwatch.ca'
const URLS_PER_SITEMAP = 20000 // Must match app/sitemap.ts

export async function GET() {
  const [drugCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(drugs)

  const [reportCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)

  const drugSitemaps = Math.ceil((drugCount?.count || 0) / URLS_PER_SITEMAP)
  const reportSitemaps = Math.ceil((reportCount?.count || 0) / URLS_PER_SITEMAP)
  const totalSitemaps = 1 + drugSitemaps + reportSitemaps

  const sitemapUrls = Array.from({ length: totalSitemaps }, (_, i) =>
    `  <sitemap>\n    <loc>${baseUrl}/sitemap/${i}.xml</loc>\n  </sitemap>`
  ).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</sitemapindex>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
