import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { MobileNavProvider } from '@/components/mobile-nav';

export const metadata: Metadata = {
  title: 'RxWatch - Canadian Drug Shortage Intelligence',
  description: 'Check Canadian drug shortages and discontinuations by name or DIN. View reports and find medication alternatives.',
  metadataBase: new URL('https://rxwatch.ca'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'RxWatch',
  },
  openGraph: {
    title: 'RxWatch - Canadian Drug Shortage Intelligence',
    description: 'Check Canadian drug shortages and discontinuations by name or DIN. View reports and find medication alternatives.',
    url: 'https://rxwatch.ca',
    siteName: 'RxWatch Canada',
    images: [
      {
        url: '/RxWatch-share.png',
        width: 1200,
        height: 630,
        alt: 'RxWatch - Canadian Drug Shortage Intelligence',
      },
    ],
    locale: 'en_CA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RxWatch - Canadian Drug Shortage Intelligence',
    description: 'Check Canadian drug shortages and discontinuations by name or DIN. View reports and find medication alternatives.',
    images: ['/RxWatch-share.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MobileNavProvider>
            <TooltipProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <SiteHeader />
                  <main className="flex-1 p-4 md:p-6 gradient-bg min-h-[calc(100vh-3.5rem)]">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
          </MobileNavProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
