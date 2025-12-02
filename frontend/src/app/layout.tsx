import type { Metadata } from "next";
import { Poppins, Fira_Code, Lora } from "next/font/google";
import "./globals.css";
import { PushWalletProvider } from "@/contexts/PushWalletProvider";
import { Analytics } from '@vercel/analytics/next';

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hodl.fun - Token Launchpad",
  description: "Create and trade tokens with bonding curve mechanics on Push Chain - Hodl.fun",
  keywords: "token, crypto, blockchain, hodl, push chain, bonding curve, defi, trading",
  authors: [{ name: "Hodl.fun" }],
  creator: "Hodl.fun",
  publisher: "Hodl.fun",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/hodl-logo.png',
    shortcut: '/hodl-logo.png',
    apple: '/hodl-logo.png',
  },
  openGraph: {
    title: "Hodl.fun - Token Launchpad",
    description: "Create and trade tokens with bonding curve mechanics on Push Chain",
    url: "https://thehodl.fun",
    siteName: "Hodl.fun",
    images: [
      {
        url: '/hodl-logo.png',
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
    title: "Hodl.fun - Token Launchpad",
    description: "Create and trade tokens with bonding curve mechanics on Push Chain",
    images: ['/hodl-logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${firaCode.variable} ${lora.variable} antialiased font-sans`}
      >
        <PushWalletProvider>
          {children}
        </PushWalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
