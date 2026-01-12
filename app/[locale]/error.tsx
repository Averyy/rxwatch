'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorPage');

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground max-w-md">
          {t('description')}
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>
          {t('tryAgain')}
        </Button>
        <Link href="/">
          <Button variant="outline">{t('goHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
