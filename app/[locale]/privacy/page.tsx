import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PrivacyPage' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('PrivacyPage');
  const tCommon = await getTranslations('Common');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('lastUpdated')}</p>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('overviewTitle')}</h2>
          <p className="text-muted-foreground">
            {t('overviewDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('collectTitle')}</h2>
          <p className="text-muted-foreground">
            <strong>{t('collectNoPersonal')}</strong> {t('collectDesc')}
          </p>
          <p className="text-muted-foreground">
            {t('collectAnalytics')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>{t('collectPageViews')}</li>
            <li>{t('collectBrowser')}</li>
            <li>{t('collectGeo')}</li>
            <li>{t('collectPerformance')}</li>
          </ul>
          <p className="text-muted-foreground">
            {t('collectNote')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('cookiesTitle')}</h2>
          <p className="text-muted-foreground">
            {t('cookiesDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('thirdPartyTitle')}</h2>
          <p className="text-muted-foreground">
            {t('thirdPartyDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('dataSourcesTitle')}</h2>
          <p className="text-muted-foreground">
            {t('dataSourcesDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('changesTitle')}</h2>
          <p className="text-muted-foreground">
            {t('changesDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('contactTitle')}</h2>
          <p className="text-muted-foreground">
            {t('contactDesc')}{' '}
            <a href="mailto:info@rxwatch.ca" className="text-primary hover:underline">
              info@rxwatch.ca
            </a>
          </p>
        </section>
      </div>

      <div className="flex justify-center pt-4 border-t">
        <Link href={`/${locale}`}>
          <Button variant="outline">{tCommon('backToHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
