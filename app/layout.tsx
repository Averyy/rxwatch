import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
};

// Root layout only provides metadata and renders children
// HTML/body are rendered in [locale]/layout.tsx with proper lang attribute
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
