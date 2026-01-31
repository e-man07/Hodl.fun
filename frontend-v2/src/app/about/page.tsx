import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Rocket, TrendingUp, Shield, Users, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About Hodl.fun | Token Launchpad on Push Chain',
  description: 'Learn about Hodl.fun, the fair launch token launchpad on Push Chain. Create and trade ERC20 tokens with automated bonding curve mechanics.',
  alternates: {
    canonical: 'https://www.thehodl.fun/about',
  },
};

export default function AboutPage() {
  return (
    <div className="container max-w-4xl py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <h1 className="text-4xl font-bold mb-4">About Hodl.fun</h1>
      <p className="text-xl text-muted-foreground mb-12">
        The fair launch token launchpad on Push Chain
      </p>

      {/* Mission Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Our Mission</h2>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Hodl.fun democratizes token creation by providing a fair, transparent, and accessible
          platform for launching ERC20 tokens. We believe everyone should have the opportunity
          to create and trade tokens without pre-sales, team allocations, or insider advantages.
        </p>
      </section>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Launch Your Token</h3>
              <p className="text-muted-foreground">
                Create an ERC20 token in seconds. Choose a name, symbol, and optional logo.
                Pay a small deploy fee and your token is live immediately.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Bonding Curve Trading</h3>
              <p className="text-muted-foreground">
                Tokens start on an automated bonding curve for fair price discovery.
                Price increases as more tokens are bought, ensuring transparent pricing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. Graduation to DEX</h3>
              <p className="text-muted-foreground">
                When market cap reaches the threshold (1M PUSH), tokens automatically
                graduate to a decentralized exchange for improved liquidity.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4. Creator Rewards</h3>
              <p className="text-muted-foreground">
                Token creators earn 30% of all trading fees. As your token gains traction,
                you earn ongoing rewards for building something people value.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Fair Launch Principles */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Fair Launch Principles</h2>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <ul className="space-y-4 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">No Pre-sale</span>
                <span>Everyone buys on the same bonding curve. No insider access.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">No Team Allocation</span>
                <span>100% of tokens are available for trading from day one.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">Transparent Pricing</span>
                <span>The bonding curve formula is public and auditable.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">Immutable Contracts</span>
                <span>Smart contracts are non-upgradeable after deployment.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Built on Push Chain */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Built on Push Chain</h2>
        <p className="text-muted-foreground text-lg mb-6">
          Hodl.fun is built on Push Chain, a high-performance EVM-compatible blockchain
          optimized for DeFi applications. Push Chain provides fast transactions, low fees,
          and a growing ecosystem of tools and integrations.
        </p>
        <Button asChild variant="outline">
          <Link
            href="https://push.org"
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2"
          >
            Learn about Push Chain
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Connect */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">Connect With Us</h2>
        <p className="text-muted-foreground mb-6">
          Follow us on Twitter for updates, announcements, and community discussions.
        </p>
        <Button asChild>
          <Link
            href="https://x.com/thehodldotfun"
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2"
          >
            Follow @thehodldotfun
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* CTA */}
      <section className="text-center py-12 border-t border-border">
        <h2 className="text-2xl font-semibold mb-4">Ready to Launch?</h2>
        <p className="text-muted-foreground mb-6">
          Create your token in seconds and start trading immediately.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/launch">Launch Token</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Explore Tokens</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
