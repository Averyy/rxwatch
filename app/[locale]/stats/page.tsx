import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAlternates } from '@/lib/metadata';
import StatsClient from './StatsClient';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'StatsPage' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: getAlternates(locale, '/stats'),
  };
}

export default function StatsPage() {
  return <StatsClient />;
}
