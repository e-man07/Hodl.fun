'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const VoteBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative w-full bg-gradient-to-r from-primary via-purple-600 to-secondary border-b-2 border-primary/50 overflow-hidden shadow-lg">
      {/* Animated background effects */}
      <div className="absolute inset-0">
        {/* Shimmer effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          style={{
            animation: 'shimmer 2s infinite',
            transform: 'translateX(-100%)',
          }}
        ></div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5 relative z-10">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left side - Message */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm md:text-base font-bold text-white leading-tight drop-shadow-md truncate sm:whitespace-normal">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200">
                  🗳️ Vote for Hodl.fun
                </span>
                <span className="hidden sm:inline"> - Engage with this tweet and help us win!</span>
                <span className="sm:hidden"> - Help us win!</span>
              </p>
            </div>
          </div>

          {/* Right side - CTA button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              asChild
              size="sm"
              className="bg-white hover:bg-gray-100 text-primary shadow-lg hover:shadow-xl border-2 border-white/50 transition-all duration-200 hover:scale-105 group font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 h-auto animate-blink"
            >
              <Link
                href="https://x.com/PushChain/status/1989664475784663041"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
              >
                <span className="hidden sm:inline">Engage</span>
                <span className="sm:hidden">Vote</span>
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
      <style jsx global>{`
        .animate-blink {
          animation: blink 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

