import React from 'react';
import Link from 'next/link';
import { NETWORK } from '@/lib/contracts/config';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-primary">Hodl.fun</span>
            <span className="text-sm text-muted-foreground">
              Token Launchpad on Push Chain
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/about"
              className="hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href={NETWORK.blockExplorer}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Explorer
            </Link>
            <Link
              href="https://x.com/thehodldotfun"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Twitter
            </Link>
            <Link
              href="https://push.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Push Protocol
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          <p>Trading tokens involves risk. Only invest what you can afford to lose.</p>
        </div>
      </div>
    </footer>
  );
}
