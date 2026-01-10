import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy | RxWatch',
  description: 'Privacy policy for RxWatch, the Canadian drug shortage intelligence tool.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">Coming soon.</p>
      </div>

      <div className="flex justify-center pt-4">
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
