'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Trophy,
  Plus,
  BarChart3,
  Search,
  Wallet,
  LogOut,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUIStore } from '@/store/ui';
import { useWallet } from '@/hooks/use-wallet';
import { truncateAddress, cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Explore', icon: Home },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/launch', label: 'Launch Token', icon: Plus },
];

const userLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
];

export function MobileMenu() {
  const pathname = usePathname();
  const { mobileMenuOpen, setMobileMenuOpen, setSearchOpen } = useUIStore();
  const { isConnected, address, balance, connect, disconnect, isConnecting } = useWallet();

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const handleSearchClick = () => {
    setMobileMenuOpen(false);
    setSearchOpen(true);
  };

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-left">
            <span className="text-xl font-bold text-primary">Hodl.fun</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-80px)]">
          {/* Search Button */}
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={handleSearchClick}
            >
              <Search className="h-4 w-4" />
              Search tokens...
            </Button>
          </div>

          <Separator />

          {/* Main Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* User Links (only if connected) - use ternary for safety (rendering-conditional-render rule) */}
            {isConnected ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  {userLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={handleNavClick}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}
          </nav>

          {/* Wallet Section */}
          <div className="p-4 border-t border-border">
            {isConnected && address ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50">
                  <Wallet className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {truncateAddress(address)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {balance} PUSH
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    disconnect();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  connect();
                  setMobileMenuOpen(false);
                }}
                disabled={isConnecting}
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
