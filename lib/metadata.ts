import { locales } from '@/i18n/config'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxwatch.ca'

/**
 * Generate canonical + hreflang alternates for Next.js metadata.
 * Every page needs this so Google knows which locale version is canonical
 * and how the EN/FR versions relate to each other.
 */
export function getAlternates(locale: string, path: string = '') {
  return {
    canonical: `${baseUrl}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(
        locales.map((l) => [l, `${baseUrl}/${l}${path}`])
      ),
      'x-default': `${baseUrl}${path}`,
    },
  }
}
