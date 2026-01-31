import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Hodl.fun',
  description: 'Privacy policy for Hodl.fun token launchpad. Learn how we collect, use, and protect your data.',
  alternates: {
    canonical: 'https://www.thehodl.fun/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-invert max-w-none space-y-8">
        <p className="text-muted-foreground">
          Last updated: January 2026
        </p>

        <section>
          <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-muted-foreground">
            Hodl.fun (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a decentralized token launchpad
            on Push Chain. This Privacy Policy explains how we collect, use, and protect information
            when you use our platform at www.thehodl.fun.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-medium mt-4 mb-2">Blockchain Data</h3>
          <p className="text-muted-foreground">
            When you interact with our smart contracts, your wallet address and transaction history
            become part of the public blockchain. This data is inherently public and immutable.
          </p>

          <h3 className="text-lg font-medium mt-4 mb-2">Usage Data</h3>
          <p className="text-muted-foreground">
            We collect anonymous usage data through Vercel Analytics to improve our service, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Pages visited and time spent</li>
            <li>Browser type and device information</li>
            <li>Referring websites</li>
            <li>General geographic location (country level)</li>
          </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Local Storage</h3>
          <p className="text-muted-foreground">
            We store certain preferences locally in your browser, such as recent searches and
            UI preferences. This data never leaves your device.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">3. How We Use Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>To provide and maintain our token launchpad service</li>
            <li>To process transactions on the blockchain</li>
            <li>To improve and optimize user experience</li>
            <li>To detect and prevent fraudulent activity</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">4. Data Sharing</h2>
          <p className="text-muted-foreground">
            We do not sell or rent your personal information. We may share data with:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Analytics providers (Vercel Analytics) for usage statistics</li>
            <li>Blockchain networks (Push Chain) for transaction processing</li>
            <li>Law enforcement when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">5. Blockchain Transparency</h2>
          <p className="text-muted-foreground">
            All transactions on Push Chain are public and permanent. This includes token creation,
            trades, and wallet addresses. We cannot delete or modify blockchain data. Consider this
            when interacting with our platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">6. Security</h2>
          <p className="text-muted-foreground">
            We implement industry-standard security measures to protect our platform. However,
            no internet transmission is completely secure. You are responsible for keeping your
            wallet private keys safe.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
          <p className="text-muted-foreground">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Access your data stored in our systems</li>
            <li>Request deletion of off-chain data</li>
            <li>Opt out of analytics tracking</li>
            <li>Clear local storage in your browser</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Note: Blockchain data cannot be deleted due to its immutable nature.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">8. Contact</h2>
          <p className="text-muted-foreground">
            For privacy-related questions, contact us on{' '}
            <Link
              href="https://x.com/thehodldotfun"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Twitter/X
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">9. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify users of significant
            changes through our platform or social media channels.
          </p>
        </section>
      </div>
    </div>
  );
}
