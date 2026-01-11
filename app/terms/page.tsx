import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | RxWatch Canada',
  description: 'Terms of service for RxWatch Canada, the Canadian drug shortage intelligence tool.',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: January 2025</p>
      </div>

      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg">Medical Disclaimer</AlertTitle>
        <AlertDescription className="mt-2">
          <strong>RxWatch is not medical advice.</strong> Always consult your pharmacist,
          doctor, or other qualified healthcare professional before making any changes to
          your medications.
        </AlertDescription>
      </Alert>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By using RxWatch Canada (&ldquo;the Service&rdquo;), you agree to these terms.
            If you do not agree, please do not use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Description of Service</h2>
          <p className="text-muted-foreground">
            RxWatch is a free informational tool that aggregates publicly available data
            about drug shortages and discontinuations in Canada. The Service displays
            information from Drug Shortages Canada and Health Canada&apos;s Drug Product Database.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">No Medical Advice</h2>
          <p className="text-muted-foreground">
            The information provided by RxWatch is for informational purposes only and is
            not intended to be a substitute for professional medical advice, diagnosis, or
            treatment. Never disregard professional medical advice or delay seeking it
            because of information you read on this website.
          </p>
          <p className="text-muted-foreground">
            Alternative medication suggestions shown on this website are provided for
            informational purposes only and must be verified by a qualified healthcare
            professional before making any changes to your medication regimen.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Accuracy</h2>
          <p className="text-muted-foreground">
            While we strive to keep information accurate and up-to-date, we make no
            warranties about the completeness, reliability, or accuracy of the information
            displayed. Drug shortage information is sourced from official government
            databases and updated regularly, but may not reflect real-time availability
            at your local pharmacy.
          </p>
          <p className="text-muted-foreground">
            For official information, always refer to{' '}
            <a
              href="https://www.drugshortagescanada.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Drug Shortages Canada
            </a>
            {' '}and{' '}
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
          <h2 className="text-xl font-semibold">Limitation of Liability</h2>
          <p className="text-muted-foreground">
            RxWatch and its operators shall not be liable for any direct, indirect,
            incidental, consequential, or punitive damages arising from your use of
            the Service or any information obtained through it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Service Availability</h2>
          <p className="text-muted-foreground">
            We do not guarantee that the Service will be available at all times. We may
            modify, suspend, or discontinue the Service at any time without notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Intellectual Property</h2>
          <p className="text-muted-foreground">
            RxWatch is open-source software. The source code is available on{' '}
            <a
              href="https://github.com/Averyy/rxwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            . Drug and shortage data is sourced from official Canadian government databases.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these terms at any time. Continued use of the
            Service after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            If you have questions about these terms, please contact us at{' '}
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
