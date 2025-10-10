'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button as RetroButton, Card as RetroCard } from 'pixel-retroui';
import { WalletButton } from '@/components/WalletButton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Zap } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/launch', label: 'Launch Token' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b-4 border-yellow-400 bg-black">
      <div className="container flex h-20 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3">
          <RetroCard className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-yellow-400 to-red-500 border-4 border-white">
            <Zap className="h-6 w-6 text-black" />
          </RetroCard>
          <span className="text-2xl font-bold font-minecraft text-cyan-400">TOKENLAUNCH</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-2">
          {navItems.map((item) => (
            <RetroButton
              key={item.href}
              className="bg-gray-800 hover:bg-purple-600 text-green-400 font-bold px-4 py-2 border-2 border-green-400 font-minecraft text-sm"
              onClick={() => window.location.href = item.href}
            >
              {item.label.toUpperCase()}
            </RetroButton>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-3">
          <WalletButton />
          <RetroButton 
            className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 border-4 border-white font-minecraft text-sm"
            onClick={() => window.location.href = '/launch'}
          >
            🚀 LAUNCH TOKEN
          </RetroButton>
        </div>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <RetroButton className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-2 border-2 border-white">
              <Menu className="h-5 w-5" />
            </RetroButton>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-black border-l-4 border-cyan-400">
            <div className="flex flex-col space-y-4 mt-6">
              <div className="flex items-center space-x-3 mb-6">
                <RetroCard className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-yellow-400 to-red-500 border-4 border-white">
                  <Zap className="h-5 w-5 text-black" />
                </RetroCard>
                <span className="text-xl font-bold font-minecraft text-cyan-400">TOKENLAUNCH</span>
              </div>
              
              <nav className="flex flex-col space-y-3">
                {navItems.map((item) => (
                  <RetroButton
                    key={item.href}
                    className="bg-gray-800 hover:bg-purple-600 text-green-400 font-bold px-4 py-3 border-2 border-green-400 font-minecraft text-left w-full"
                    onClick={() => {
                      window.location.href = item.href;
                      setIsOpen(false);
                    }}
                  >
                    {item.label.toUpperCase()}
                  </RetroButton>
                ))}
              </nav>
              
              <div className="flex flex-col space-y-3 pt-4 border-t-2 border-yellow-400">
                <WalletButton variant="mobile" />
                <RetroButton 
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-3 border-4 border-white font-minecraft w-full"
                  onClick={() => {
                    window.location.href = '/launch';
                    setIsOpen(false);
                  }}
                >
                  🚀 LAUNCH TOKEN
                </RetroButton>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;
