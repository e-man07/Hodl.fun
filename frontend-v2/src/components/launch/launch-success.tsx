'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Copy, Rocket, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { copyToClipboard, truncateAddress } from '@/lib/utils';
import { NETWORK } from '@/lib/contracts/config';

interface LaunchSuccessProps {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  transactionHash?: string;
  onLaunchAnother: () => void;
}

export function LaunchSuccess({
  tokenAddress,
  tokenName,
  tokenSymbol,
  transactionHash,
  onLaunchAnother,
}: LaunchSuccessProps) {
  const handleCopyAddress = async () => {
    const success = await copyToClipboard(tokenAddress);
    if (success) {
      toast.success('Token address copied!');
    }
  };

  return (
    <div className="container max-w-lg py-16">
      <Card>
        <CardContent className="pt-8 pb-6 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">Token Launched!</h1>
          <p className="text-muted-foreground mb-6">
            Your token <span className="text-foreground font-medium">{tokenName}</span> ({tokenSymbol}) is now live and trading
          </p>

          {/* Token Address */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-xs text-muted-foreground mb-2">Contract Address</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-sm font-mono">{truncateAddress(tokenAddress, 12, 10)}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopyAddress}
                aria-label="Copy contract address"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Link
                href={`${NETWORK.blockExplorer}/address/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="View on block explorer">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Transaction Hash - use ternary for conditional rendering (rendering-conditional-render rule) */}
          {transactionHash ? (
            <div className="text-xs text-muted-foreground mb-6">
              <span>Transaction: </span>
              <Link
                href={`${NETWORK.blockExplorer}/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {truncateAddress(transactionHash, 10, 8)}
              </Link>
            </div>
          ) : null}

          <Separator className="mb-6" />

          {/* Actions */}
          <div className="space-y-3">
            <Button asChild className="w-full gap-2" size="lg">
              <Link href={`/token/${tokenAddress}`}>
                <BarChart3 className="h-4 w-4" />
                View Token Page
              </Link>
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onLaunchAnother}
            >
              <Rocket className="h-4 w-4" />
              Launch Another Token
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground mt-6">
            Trading is now live! Share your token with the community to attract traders.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
