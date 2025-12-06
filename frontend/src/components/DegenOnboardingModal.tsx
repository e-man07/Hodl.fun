'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
      <DialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[320px] sm:!w-[380px] !max-w-[calc(100vw-2rem)] bg-background border border-zinc-800 z-[100] p-6 !m-0 rounded-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold text-center">
            Welcome to <span className="text-primary">hodl.fun</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-center text-sm text-muted-foreground py-2">
          <p>
            By continuing, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
          <p className="mt-1">
            and confirm you are <strong className="text-white">18 years of age or older</strong>.
          </p>
        </div>

        <Button
          onClick={handleClose}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 mt-2 rounded-full"
        >
          Agree and Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};
