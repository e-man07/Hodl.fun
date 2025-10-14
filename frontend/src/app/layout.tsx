import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PushWalletProvider } from "@/contexts/PushWalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hodl.fun - Retro Token Platform",
  description: "Create and trade tokens with bonding curve mechanics on Push Chain - hodl.fun",
  keywords: "token, crypto, blockchain, hodl, push chain, bonding curve, defi, trading",
  authors: [{ name: "hodl.fun" }],
  creator: "hodl.fun",
  publisher: "hodl.fun",
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
    title: "hodl.fun - Retro Token Platform",
    description: "Create and trade tokens with bonding curve mechanics on Push Chain",
    url: "https://hodl.fun",
    siteName: "hodl.fun",
    images: [
      {
        url: '/hodl-logo.png',
        width: 1200,
        height: 630,
        alt: 'hodl.fun - Retro Token Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "hodl.fun - Retro Token Platform",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PushWalletProvider>
          {children}
        </PushWalletProvider>
      </body>
    </html>
  );
}
