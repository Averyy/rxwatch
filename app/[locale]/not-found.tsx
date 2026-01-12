import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('NotFoundPage');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground max-w-md">
          {t('description')}
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/">
          <Button>{t('goHome')}</Button>
        </Link>
        <Link href="/drugs">
          <Button variant="outline">{t('browseDrugs')}</Button>
        </Link>
      </div>
    </div>
  );
}
