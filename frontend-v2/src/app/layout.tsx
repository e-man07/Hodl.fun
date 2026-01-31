import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { SearchModal } from '@/components/layout/search-modal';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { OrganizationSchema, WebSiteSchema } from '@/components/seo/json-ld';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.thehodl.fun'),
  title: 'Hodl.fun - Token Launchpad on Push Chain',
  description:
    'Create and trade ERC20 tokens with bonding curve mechanics on Push Chain. Launch your token in seconds.',
  keywords: 'token, crypto, blockchain, push chain, bonding curve, defi, trading, launchpad',
  authors: [{ name: 'Hodl.fun' }],
  creator: 'Hodl.fun',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: [
      { url: '/hodl-logo.svg', type: 'image/svg+xml' },
      { url: '/hodl-logo.png', sizes: '180x180' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'Hodl.fun - Token Launchpad',
    description: 'Create and trade tokens with bonding curve mechanics on Push Chain',
    url: 'https://www.thehodl.fun',
    siteName: 'Hodl.fun',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Hodl.fun - Token Launchpad',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hodl.fun - Token Launchpad',
    description: 'Create and trade tokens with bonding curve mechanics on Push Chain',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.thehodl.fun',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <OrganizationSchema />
        <WebSiteSchema />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <MobileMenu />
          <SearchModal />
          <NavigationProgress />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
