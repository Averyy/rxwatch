import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'TermsPage' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('TermsPage');
  const tCommon = await getTranslations('Common');
  const tAbout = await getTranslations('AboutPage');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('lastUpdated')}</p>
      </div>

      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg">{t('disclaimerTitle')}</AlertTitle>
        <AlertDescription className="mt-2">
          <strong>{t('disclaimerText')}</strong> {t('disclaimerDesc')}
        </AlertDescription>
      </Alert>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('acceptanceTitle')}</h2>
          <p className="text-muted-foreground">
            {t('acceptanceDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('descriptionTitle')}</h2>
          <p className="text-muted-foreground">
            {t('descriptionDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('noMedicalTitle')}</h2>
          <p className="text-muted-foreground">
            {t('noMedicalDesc1')}
          </p>
          <p className="text-muted-foreground">
            {t('noMedicalDesc2')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('accuracyTitle')}</h2>
          <p className="text-muted-foreground">
            {t('accuracyDesc1')}
          </p>
          <p className="text-muted-foreground">
            {t('accuracyDesc2')}{' '}
            <a
              href="https://www.healthproductshortages.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Drug Shortages Canada
            </a>
            {' '}{tAbout('and')}{' '}
            <a
              href="https://www.canada.ca/en/health-canada.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Health Canada
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('liabilityTitle')}</h2>
          <p className="text-muted-foreground">
            {t('liabilityDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('availabilityTitle')}</h2>
          <p className="text-muted-foreground">
            {t('availabilityDesc')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('ipTitle')}</h2>
          <p className="text-muted-foreground">
            {t('ipDesc')}
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
