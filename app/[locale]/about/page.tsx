import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ExternalLink,
  Database,
  RefreshCw,
  Shield,
  AlertTriangle,
  Github,
  Mail,
  Heart,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ===========================================
// METADATA
// ===========================================

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AboutPage' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

// ===========================================
// PAGE COMPONENT
// ===========================================

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('AboutPage');
  const tCommon = await getTranslations('Common');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Important Disclaimer - Must be prominent */}
      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg">{t('disclaimerTitle')}</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            <strong>{t('disclaimerNotMedical')}</strong> {t('disclaimerText')}
          </p>
          <p>
            {t('disclaimerConsult')}
          </p>
          <p>
            {t('disclaimerAlternatives')}
          </p>
        </AlertDescription>
      </Alert>

      {/* What is RxWatch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            {t('whatIsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {t('whatIsDesc1')}
          </p>
          <p>
            {t('whatIsGoal')}
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{t('whatIsCheck')}</li>
            <li>{t('whatIsFind')}</li>
            <li>{t('whatIsTrack')}</li>
            <li>{t('whatIsUnderstand')}</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            {t('whatIsNotAffiliated')}
          </p>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {t('dataSourcesTitle')}
          </CardTitle>
          <CardDescription>
            {t('dataSourcesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t('dscTitle')}</h3>
              <a
                href="https://www.healthproductshortages.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('dscDesc1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('dscDesc2')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t('dpdTitle')}</h3>
              <a
                href="https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('dpdDesc1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('dpdDesc2')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            {t('dataFreshnessTitle')}
          </CardTitle>
          <CardDescription>
            {t('dataFreshnessDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="font-medium">{t('shortageReports')}</p>
              <p className="text-sm text-muted-foreground">
                {t('shortageReportsFreq')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t('drugCatalog')}</p>
              <p className="text-sm text-muted-foreground">
                {t('drugCatalogFreq')}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {t('dataFreshnessNote')}
          </p>
        </CardContent>
      </Card>

      {/* Understanding the Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('understandingTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">{t('reportStatusesTitle')}</h3>
            <div className="grid gap-2">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shrink-0">
                  {t('statusActive')}
                </span>
                <span className="text-sm">{t('statusActiveDesc')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 shrink-0">
                  {t('statusAnticipated')}
                </span>
                <span className="text-sm">{t('statusAnticipatedDesc')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 shrink-0">
                  {t('statusToBeDisc')}
                </span>
                <span className="text-sm">{t('statusToBeDiscDesc')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 shrink-0">
                  {t('statusDiscontinued')}
                </span>
                <span className="text-sm">{t('statusDiscontinuedDesc')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
                  {t('statusResolved')}
                </span>
                <span className="text-sm">{t('statusResolvedDesc')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">{t('tier3Title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('tier3Desc')}
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
              <li>{t('tier3NoAlternatives')}</li>
              <li>{t('tier3Essential')}</li>
              <li>{t('tier3Harm')}</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">{t('alternativesTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('alternativesDesc')}
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
              <li>
                <strong>{t('sameIngredient')}</strong> {t('sameIngredientDesc')}
              </li>
              <li>
                <strong>{t('sameClass')}</strong> {t('sameClassDesc')}
              </li>
            </ul>
            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
              {t('alternativesWarning')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>{t('privacyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('privacyDesc1')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('privacyDesc2')}
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contactTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('contactDesc')}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/Averyy/rxwatch/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                {t('reportIssue')}
              </Button>
            </a>
            <a href="mailto:info@rxwatch.ca">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                {t('sendFeedback')}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Final Disclaimer */}
      <div className="border-t pt-6 space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          {t('finalDisclaimer1')}
        </p>
        <p className="text-sm text-muted-foreground text-center">
          {t('finalDisclaimer2')}{' '}
          <a
            href="https://www.healthproductshortages.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Drug Shortages Canada
          </a>
          {' '}{t('and')}{' '}
          <a
            href="https://www.canada.ca/en/health-canada.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Health Canada
          </a>
          .
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-center pb-4">
        <Link href={`/${locale}`}>
          <Button variant="outline">{tCommon('backToHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
