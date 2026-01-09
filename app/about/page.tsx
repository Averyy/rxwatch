import { Metadata } from 'next';
import Link from 'next/link';
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

export const metadata: Metadata = {
  title: 'About RxWatch | Canadian Drug Shortage Intelligence',
  description:
    'Learn about RxWatch, a free tool for tracking Canadian drug shortages. Understand our data sources, update frequency, and how to use the service.',
};

// ===========================================
// PAGE COMPONENT
// ===========================================

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">About RxWatch</h1>
        <p className="text-lg text-muted-foreground">
          Free, real-time drug shortage intelligence for Canadians
        </p>
      </div>

      {/* Important Disclaimer - Must be prominent */}
      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg">Important Medical Disclaimer</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            <strong>This is not medical advice.</strong> RxWatch is an informational tool only.
          </p>
          <p>
            Always consult your pharmacist, doctor, or other qualified healthcare professional
            before making any changes to your medications.
          </p>
          <p>
            Alternative medication suggestions require verification by a healthcare professional.
            Do not switch medications without professional guidance.
          </p>
        </AlertDescription>
      </Alert>

      {/* What is RxWatch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            What is RxWatch?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            RxWatch is a free, open-source tool that helps Canadians stay informed about
            drug shortages affecting medications they depend on. We aggregate data from
            official government sources and present it in an easy-to-understand format.
          </p>
          <p>
            Our goal is to help patients, caregivers, and healthcare providers:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Check if a medication is currently in shortage</li>
            <li>Find potential therapeutic alternatives (for discussion with your doctor)</li>
            <li>Track when shortages are resolved</li>
            <li>Understand which medications are being discontinued</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            RxWatch is not affiliated with Health Canada, Drug Shortages Canada, or any
            pharmaceutical company.
          </p>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Sources
          </CardTitle>
          <CardDescription>
            All data comes from official Canadian government and regulatory sources
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Drug Shortages Canada (DSC)</h3>
              <a
                href="https://www.drugshortagescanada.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              The mandatory reporting system for drug shortages and discontinuations in Canada.
              Pharmaceutical companies are legally required to report shortages to this database.
            </p>
            <p className="text-sm text-muted-foreground">
              Shortage reports, discontinuation notices, status updates,
              company information, shortage reasons, and estimated resolution dates.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Health Canada Drug Product Database (DPD)</h3>
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
              The official database of all drugs authorized for sale in Canada.
              Contains detailed information about drug formulations, ingredients, and manufacturers.
            </p>
            <p className="text-sm text-muted-foreground">
              Drug identification numbers (DINs), active ingredients, dosage forms, routes of administration,
              therapeutic classifications (ATC codes), and manufacturer information.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Data Freshness
          </CardTitle>
          <CardDescription>
            How often we update our data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="font-medium">Shortage Reports</p>
              <p className="text-sm text-muted-foreground">
                Updated every <strong>15 minutes</strong> from Drug Shortages Canada API
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Drug Catalog</p>
              <p className="text-sm text-muted-foreground">
                Updated <strong>daily</strong> from Health Canada Drug Product Database
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            The last sync time is displayed in the header of every page.
            If you notice stale data, please let us know.
          </p>
        </CardContent>
      </Card>

      {/* Understanding the Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Understanding Shortage Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Report Statuses</h3>
            <div className="grid gap-2">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shrink-0">
                  Active
                </span>
                <span className="text-sm">Drug is currently in shortage</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 shrink-0">
                  Anticipated
                </span>
                <span className="text-sm">Shortage expected to occur soon</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 shrink-0">
                  To Be Discontinued
                </span>
                <span className="text-sm">Drug will be permanently removed from market</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 shrink-0">
                  Discontinued
                </span>
                <span className="text-sm">Drug has been permanently removed from market</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
                  Resolved
                </span>
                <span className="text-sm">Shortage has ended, drug is available again</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Tier 3 Critical Shortages</h3>
            <p className="text-sm text-muted-foreground">
              Tier 3 shortages are the most critical. These affect drugs where:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
              <li>No therapeutic alternatives exist</li>
              <li>The drug is essential for life-threatening conditions</li>
              <li>Interruption could cause serious harm to patients</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Understanding Alternatives</h3>
            <p className="text-sm text-muted-foreground">
              When viewing a drug, we show two types of potential alternatives:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
              <li>
                <strong>Same Ingredient:</strong> Other products containing the same active
                ingredient (different manufacturer, strength, or form)
              </li>
              <li>
                <strong>Same Therapeutic Class:</strong> Different drugs that may treat the same
                condition (same ATC classification)
              </li>
            </ul>
            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
              These are suggestions only. Always consult your healthcare provider before
              switching to an alternative medication.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            RxWatch does not collect personal health information. We do not require accounts
            or logins to use the service. Your searches are not tracked or stored.
          </p>
          <p className="text-sm text-muted-foreground">
            We use basic analytics to understand how the service is used and improve it,
            but this data is anonymized and aggregated.
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Contact & Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            RxWatch is an open-source project. We welcome feedback, bug reports, and contributions.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/anthropics/claude-code/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                Report an Issue
              </Button>
            </a>
            <a href="mailto:feedback@rxwatch.ca">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Send Feedback
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Final Disclaimer */}
      <div className="border-t pt-6 space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          RxWatch is provided &ldquo;as is&rdquo; without warranty of any kind. While we strive
          for accuracy, we cannot guarantee the completeness or timeliness of the data.
        </p>
        <p className="text-sm text-muted-foreground text-center">
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
          </a>
          .
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-center pb-4">
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
