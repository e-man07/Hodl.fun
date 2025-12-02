'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Rocket, Coins, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';

export const DegenOnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding before
    const seen = localStorage.getItem('hodl-fun-onboarding-seen');
    if (!seen) {
      // Small delay to let page load first
      setTimeout(() => setIsOpen(true), 500);
    } else {
      setHasSeenOnboarding(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hodl-fun-onboarding-seen', 'true');
    setHasSeenOnboarding(true);
  };

  if (hasSeenOnboarding) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] bg-background border-2 border-primary/20 z-[100]">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            How it works 🚀
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            hodl.fun lets <strong className="text-primary">anyone</strong> create tokens. 
            All tokens are <strong className="text-primary">fair-launch</strong> with bonding curves.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Pick a token you like
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Browse trending tokens or search for something specific. Every token starts on a bonding curve.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Buy on the bonding curve
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Buy tokens directly from the bonding curve. Price increases as more tokens are bought.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Sell anytime
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sell your tokens back to the bonding curve at any time to lock in profits or cut losses.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            By clicking below, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms of Service</a> and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a> and confirm you are{' '}
            <strong>18 years of age or older</strong>.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleClose}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-lg font-bold py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Zap className="mr-2 h-5 w-5" />
              I&apos;m ready to ape 🚀
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleClose}
              className="w-full"
              asChild
            >
              <Link href="/launch">
                <Rocket className="mr-2 h-4 w-4" />
                Create my own token
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

