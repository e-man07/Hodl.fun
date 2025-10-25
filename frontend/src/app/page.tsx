'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  TrendingUp,
  Shield,
  Coins,
  Users,
  BarChart3,
  Rocket,
  ArrowRight,
  Star,
  Globe,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';

// Animation hook for intersection observer
const useInView = (options = {}) => {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold: 0.1, ...options });

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);

  return { ref, isInView };
};

// Counter animation hook
const useCountUp = (end: number, duration = 2000, isInView: boolean) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, isInView]);

  return count;
};

const HomePage = () => {
  const [mounted, setMounted] = useState(false);
  const stats = useInView();
  const features = useInView();
  const steps = useInView();
  const cta = useInView();

  useEffect(() => {
    setMounted(true);
  }, []);

  const featuresData = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Instant Token Creation',
      description: 'Launch your ERC20 token in minutes with our intuitive interface and automated smart contracts.',
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Bonding Curve Pricing',
      description: 'Automated price discovery through bonding curves ensures fair token distribution and liquidity.',
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Security First',
      description: 'Built with battle-tested OpenZeppelin contracts and comprehensive security measures.',
    },
    {
      icon: <Coins className="h-6 w-6" />,
      title: 'Auto Marketplace Listing',
      description: 'Tokens are automatically listed on our marketplace with built-in trading functionality.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Community Driven',
      description: 'Connect with other token creators and traders in our vibrant ecosystem.',
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Advanced Analytics',
      description: 'Track your token performance with detailed analytics and real-time metrics.',
    },
  ];

  const statsData = [
    { label: 'Tokens Launched', value: '1,234+', numericValue: 1234, suffix: '+' },
    { label: 'Total Volume', value: '$2.5M+', numericValue: 2.5, suffix: 'M+', prefix: '$' },
    { label: 'Active Users', value: '5,678+', numericValue: 5678, suffix: '+' },
    { label: 'Success Rate', value: '98%', numericValue: 98, suffix: '%' },
  ];

  const stepsData = [
    {
      step: '01',
      title: 'Create Token',
      description: 'Define your token parameters including name, symbol, supply, and metadata.',
    },
    {
      step: '02',
      title: 'Auto Deploy',
      description: 'Our smart contracts automatically deploy and list your token on the marketplace.',
    },
    {
      step: '03',
      title: 'Start Trading',
      description: 'Begin trading immediately with bonding curve pricing and automated liquidity.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 animate-gradient-shift" />

        <div className="container relative mx-auto px-4 py-12 sm:py-20 lg:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12 sm:mb-16">
              <Badge
                variant="secondary"
                className={`mb-6 sm:mb-8 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition-all duration-700 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                }`}
                style={{ transitionDelay: '100ms' }}
              >
                <Star className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse" />
                Powered by Push Chain & Bonding Curves
              </Badge>

              <h1
                className={`mb-6 sm:mb-8 text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight px-2 transition-all duration-700 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '200ms' }}
              >
                Professional Token
                <span className="block text-primary mt-2 sm:mt-3 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text">
                  Platform - hodl.fun
                </span>
              </h1>

              <p
                className={`mx-auto mb-8 sm:mb-10 max-w-3xl text-base sm:text-xl md:text-2xl text-muted-foreground leading-relaxed font-normal px-4 transition-all duration-700 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '300ms' }}
              >
                Create, deploy, and trade ERC20 tokens with automated liquidity through bonding curves.
                Built for professionals with enterprise-grade security and seamless user experience.
              </p>

              <div
                className={`flex flex-col gap-4 sm:gap-5 sm:flex-row sm:justify-center mb-12 sm:mb-16 px-4 transition-all duration-700 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '400ms' }}
              >
                <Button
                  size="lg"
                  className="text-base sm:text-lg font-semibold px-8 sm:px-10 py-6 sm:py-7 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group relative overflow-hidden"
                  asChild
                >
                  <Link href="/launch">
                    <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <Rocket className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-12 transition-transform duration-300" />
                    Launch Your Token
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base sm:text-lg font-semibold px-8 sm:px-10 py-6 sm:py-7 h-auto hover:bg-primary/10 border-2 transition-all duration-300 hover:border-primary/50 group"
                  asChild
                >
                  <Link href="/marketplace">
                    <BarChart3 className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:scale-110 transition-transform duration-300" />
                    Explore Marketplace
                    <ArrowRight className="ml-2 sm:ml-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: <Clock className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />,
                  title: 'Launch in Minutes',
                  description: 'Deploy your token in under 5 minutes with our streamlined interface',
                  bgColor: 'bg-primary/10',
                  borderColor: 'border-primary/20',
                  hoverBg: 'group-hover:bg-primary/20',
                },
                {
                  icon: <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-secondary" />,
                  title: 'Enterprise Security',
                  description: 'Battle-tested smart contracts with comprehensive security audits',
                  bgColor: 'bg-secondary/10',
                  borderColor: 'border-secondary/20',
                  hoverBg: 'group-hover:bg-secondary/20',
                },
                {
                  icon: <Globe className="h-6 w-6 sm:h-7 sm:w-7 text-accent-foreground" />,
                  title: 'Global Marketplace',
                  description: 'Instant listing with automated liquidity and global accessibility',
                  bgColor: 'bg-accent/20',
                  borderColor: 'border-accent/30',
                  hoverBg: 'group-hover:bg-accent/30',
                },
              ].map((benefit, index) => (
                <Card
                  key={index}
                  className={`group text-center border-2 hover:border-primary/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-2 bg-card ${
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${500 + index * 100}ms` }}
                >
                  <CardContent className="pt-6 pb-6 px-5 sm:pt-8 sm:pb-8 sm:px-6">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 ${benefit.bgColor} border-2 ${benefit.borderColor} rounded-xl flex items-center justify-center mx-auto mb-4 sm:mb-5 ${benefit.hoverBg} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                      {benefit.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-foreground group-hover:text-primary transition-colors duration-300">
                      {benefit.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={stats.ref} className="bg-muted/30 py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:gap-10 md:grid-cols-4 max-w-5xl mx-auto">
            {statsData.map((stat, index) => {
              const StatCounter = () => {
                const count = useCountUp(stat.numericValue, 2000, stats.isInView);
                const displayValue = stat.label === 'Total Volume'
                  ? (count / 1).toFixed(1)
                  : count.toLocaleString();

                return (
                  <div
                    className={`text-2xl sm:text-4xl md:text-5xl font-bold text-primary mb-2 sm:mb-3 group-hover:scale-110 transition-all duration-300 ${
                      stats.isInView ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    {stat.prefix}{displayValue}{stat.suffix}
                  </div>
                );
              };

              return (
                <div
                  key={index}
                  className={`text-center group transition-all duration-500 ${
                    stats.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <StatCounter />
                  <div className="text-sm sm:text-base md:text-lg text-muted-foreground font-semibold group-hover:text-foreground transition-colors duration-300">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={features.ref} className="py-16 sm:py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div
            className={`mx-auto max-w-3xl text-center mb-12 sm:mb-16 lg:mb-20 transition-all duration-700 ${
              features.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <Badge variant="outline" className="mb-4 sm:mb-6 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold">
              <Zap className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Advanced Features
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight px-2">
              Enterprise-Grade Token Infrastructure
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground leading-relaxed px-4">
              Professional-grade tools and infrastructure designed for serious token creators and traders.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {featuresData.map((feature, index) => (
              <Card
                key={index}
                className={`group hover:shadow-xl transition-all duration-500 border-2 hover:border-primary/50 hover:-translate-y-2 bg-card ${
                  features.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-4 sm:pb-5 pt-6 sm:pt-7 px-6 sm:px-7">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 sm:mb-5 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 sm:px-7 pb-6 sm:pb-7">
                  <CardDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={steps.ref} className="py-16 sm:py-20 lg:py-28 bg-muted/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div
            className={`mx-auto max-w-3xl text-center mb-12 sm:mb-16 lg:mb-20 transition-all duration-700 ${
              steps.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <Badge variant="secondary" className="mb-4 sm:mb-6 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold">
              <Rocket className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Getting Started
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight px-2">
              Simple Three-Step Process
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground leading-relaxed px-4">
              Launch your token in minutes with our streamlined, automated platform.
            </p>
          </div>

          <div className="grid gap-8 sm:gap-10 md:gap-12 md:grid-cols-3 max-w-6xl mx-auto">
            {stepsData.map((step, index) => (
              <div
                key={index}
                className={`relative transition-all duration-700 ${
                  steps.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <Card className="text-center border-2 hover:border-primary/50 transition-all duration-500 p-6 sm:p-8 hover:shadow-xl group bg-card hover:-translate-y-2">
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl sm:text-2xl font-bold mb-5 sm:mb-7 mx-auto group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:rotate-12">
                    {step.step}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-5 group-hover:text-primary transition-colors duration-300">{step.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{step.description}</p>
                </Card>
                {index < stepsData.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                    <div className="bg-background p-3 rounded-full border-2 border-primary/20 shadow-sm group-hover:border-primary/50 transition-colors duration-300">
                      <ArrowRight className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={cta.ref} className="py-16 sm:py-20 lg:py-28 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 animate-gradient-shift" />
        <div className="container mx-auto px-4 relative">
          <Card
            className={`border-2 shadow-xl max-w-5xl mx-auto bg-gradient-to-br from-card to-muted/30 overflow-hidden relative transition-all duration-700 ${
              cta.isInView ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
            <CardContent className="p-8 sm:p-12 lg:p-14 text-center relative">
              <Badge
                variant="outline"
                className={`mb-6 sm:mb-8 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all duration-700 ${
                  cta.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                }`}
                style={{ transitionDelay: '200ms' }}
              >
                <Star className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse" />
                Ready to Get Started?
              </Badge>
              <h2
                className={`text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 sm:mb-7 leading-tight px-2 transition-all duration-700 ${
                  cta.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '300ms' }}
              >
                Ready to Launch Your Token?
              </h2>
              <p
                className={`text-base sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4 transition-all duration-700 ${
                  cta.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '400ms' }}
              >
                Join the growing ecosystem of professional token creators. Launch your token with
                automated marketplace listing and enterprise-grade infrastructure.
              </p>
              <div
                className={`flex flex-col gap-4 sm:gap-5 sm:flex-row sm:justify-center transition-all duration-700 ${
                  cta.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '500ms' }}
              >
                <Button
                  size="lg"
                  className="text-base sm:text-lg font-semibold px-8 sm:px-10 py-6 sm:py-7 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group relative overflow-hidden"
                  asChild
                >
                  <Link href="/launch">
                    <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <Rocket className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-12 transition-transform duration-300" />
                    Start Building Now
                    <ArrowRight className="ml-2 sm:ml-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base sm:text-lg font-semibold px-8 sm:px-10 py-6 sm:py-7 h-auto hover:bg-primary/10 border-2 transition-all duration-300 hover:border-primary/50 group"
                  asChild
                >
                  <Link href="/marketplace">
                    <BarChart3 className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:scale-110 transition-transform duration-300" />
                    Browse Tokens
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-50" />
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col items-center justify-between gap-6 sm:gap-8 md:flex-row">
            <div className="flex items-center space-x-3 sm:space-x-4 group">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg overflow-hidden shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Image
                  src="/hodl-logo.png"
                  alt="hodl.fun logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-primary transition-all duration-300 group-hover:scale-105">
                hodl.fun
              </span>
            </div>
            <div className="flex flex-col items-center gap-5 sm:gap-6 md:flex-row md:gap-10">
              <nav className="flex gap-6 sm:gap-8">
                <Link href="/launch" className="text-sm sm:text-base text-muted-foreground hover:text-primary transition-all duration-300 font-semibold hover:scale-110 inline-block">
                  Launch
                </Link>
                <Link href="/marketplace" className="text-sm sm:text-base text-muted-foreground hover:text-primary transition-all duration-300 font-semibold hover:scale-110 inline-block">
                  Marketplace
                </Link>
                <Link href="/dashboard" className="text-sm sm:text-base text-muted-foreground hover:text-primary transition-all duration-300 font-semibold hover:scale-110 inline-block">
                  Dashboard
                </Link>
              </nav>
              <p className="text-sm sm:text-base text-muted-foreground font-medium text-center">
                © 2024 hodl.fun. Professional token infrastructure.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
