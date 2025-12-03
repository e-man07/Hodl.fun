"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/WalletButton";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Store, LucideIcon } from "lucide-react";
import Image from "next/image";

interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: "/", label: "Marketplace", icon: Store },
    { href: "/launch", label: "Launch Token" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 max-w-none">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3">
          <Image
            src="/hodl-logo.png"
            alt="Hodl.fun logo"
            width={40}
            height={40}
            className="object-contain flex-shrink-0"
          />
          <span className="text-2xl font-bold text-primary leading-tight">Hodl.fun</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={`text-sm font-medium ${isActive ? 'opacity-50 cursor-default' : ''}`}
                asChild={!isActive}
                disabled={isActive}
              >
                {isActive ? (
                  <span className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </Link>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-2">
          <WalletButton />
        </div>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 flex items-center justify-center">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-col space-y-4 mt-6">
              <div className="flex items-center space-x-3 mb-6">
                <Image
                  src="/hodl-logo.png"
                  alt="Hodl.fun logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <span className="text-xl font-bold text-primary">Hodl.fun</span>
              </div>

              <nav className="flex flex-col space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      className={`justify-start w-full ${isActive ? 'opacity-50 cursor-default' : ''}`}
                      asChild={!isActive}
                      disabled={isActive}
                      onClick={() => !isActive && setIsOpen(false)}
                    >
                      {isActive ? (
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          {item.label}
                        </span>
                      ) : (
                        <Link href={item.href} className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          {item.label}
                        </Link>
                      )}
                    </Button>
                  );
                })}
              </nav>

              <div className="flex flex-col space-y-3 pt-4 border-t">
                <WalletButton variant="mobile" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;
