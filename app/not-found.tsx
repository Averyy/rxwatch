import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          The page you're looking for doesn't exist or may have been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
        <Link href="/drugs">
          <Button variant="outline">Browse Drugs</Button>
        </Link>
      </div>
    </div>
  );
}
