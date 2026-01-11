import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy | RxWatch Canada',
  description: 'Privacy policy for RxWatch Canada, the Canadian drug shortage intelligence tool.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: January 2025</p>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            RxWatch Canada is committed to protecting your privacy. This policy explains what
            information we collect and how we use it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p className="text-muted-foreground">
            <strong>We do not collect personal information.</strong> RxWatch does not require
            accounts, logins, or any form of registration. Your searches and browsing activity
            are not tracked or stored.
          </p>
          <p className="text-muted-foreground">
            We collect only anonymous, aggregated analytics data to understand how the website
            is used and to improve performance. This includes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>Page views and general traffic patterns</li>
            <li>Browser type and device category (desktop/mobile)</li>
            <li>Country-level geographic data</li>
            <li>Site performance metrics (load times, errors)</li>
          </ul>
          <p className="text-muted-foreground">
            This data cannot be used to identify individual users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cookies</h2>
          <p className="text-muted-foreground">
            We use minimal, essential cookies for basic site functionality. We do not use
            tracking cookies or third-party advertising cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Third-Party Services</h2>
          <p className="text-muted-foreground">
            We may use privacy-respecting analytics services to collect anonymous usage data.
            These services are configured to respect user privacy and do not track users
            across websites.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-muted-foreground">
            All drug shortage and product information displayed on RxWatch comes from official
            public sources: Drug Shortages Canada and Health Canada&apos;s Drug Product Database.
            We do not collect or store any personal health information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this privacy policy from time to time. Any changes will be posted
            on this page with an updated revision date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            If you have questions about this privacy policy, please contact us at{' '}
            <a href="mailto:info@rxwatch.ca" className="text-primary hover:underline">
              info@rxwatch.ca
            </a>
          </p>
        </section>
      </div>

      <div className="flex justify-center pt-4 border-t">
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
