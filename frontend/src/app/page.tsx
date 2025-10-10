'use client';

import React from 'react';
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
import Navbar from '@/components/layout/Navbar';

const HomePage = () => {
  const features = [
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

  const stats = [
    { label: 'Tokens Launched', value: '1,234+' },
    { label: 'Total Volume', value: '$2.5M+' },
    { label: 'Active Users', value: '5,678+' },
    { label: 'Success Rate', value: '98%' },
  ];

  const steps = [
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
        <div className="container relative mx-auto px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
                <Star className="mr-2 h-4 w-4" />
                Powered by Push Chain & Bonding Curves
              </Badge>
              
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Professional Token
                <span className="block text-primary mt-1">Launchpad Platform</span>
              </h1>
              
              <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
                Create, deploy, and trade ERC20 tokens with automated liquidity through bonding curves. 
                Built for professionals with enterprise-grade security and seamless user experience.
              </p>
              
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center mb-12">
                <Button size="lg" className="text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" asChild>
                  <Link href="/launch">
                    <Rocket className="mr-2 h-5 w-5" />
                    Launch Your Token
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto hover:bg-primary/10 border-2 transition-all duration-300 hover:border-primary/50" asChild>
                  <Link href="/marketplace">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Explore Marketplace
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="group text-center border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card">
                <CardContent className="pt-6 pb-6 px-4">
                  <div className="w-12 h-12 bg-primary/10 border-2 border-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground group-hover:text-primary transition-colors">Launch in Minutes</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Deploy your token in under 5 minutes with our streamlined interface</p>
                </CardContent>
              </Card>
              
              <Card className="group text-center border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card">
                <CardContent className="pt-6 pb-6 px-4">
                  <div className="w-12 h-12 bg-secondary/10 border-2 border-secondary/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/20 transition-colors">
                    <Shield className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground group-hover:text-primary transition-colors">Enterprise Security</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Battle-tested smart contracts with comprehensive security audits</p>
                </CardContent>
              </Card>
              
              <Card className="group text-center border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card">
                <CardContent className="pt-6 pb-6 px-4">
                  <div className="w-12 h-12 bg-accent/20 border-2 border-accent/30 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/30 transition-colors">
                    <Globe className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground group-hover:text-primary transition-colors">Global Marketplace</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Instant listing with automated liquidity and global accessibility</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-3xl font-bold text-primary sm:text-4xl mb-2 group-hover:scale-105 transition-transform duration-300">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground sm:text-base font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Zap className="mr-2 h-4 w-4" />
              Advanced Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Enterprise-Grade Token Infrastructure
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Professional-grade tools and infrastructure designed for serious token creators and traders.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:-translate-y-1 bg-card">
                <CardHeader className="pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-4 py-2">
              <Rocket className="mr-2 h-4 w-4" />
              Getting Started
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Simple Three-Step Process
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Launch your token in minutes with our streamlined, automated platform.
            </p>
          </div>
          
          <div className="grid gap-12 md:grid-cols-3 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <Card className="text-center border-2 hover:border-primary/50 transition-all duration-300 p-6 hover:shadow-lg group bg-card hover:-translate-y-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mb-6 mx-auto group-hover:scale-105 transition-transform duration-300 shadow-lg">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-4 group-hover:text-primary transition-colors duration-300">{step.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{step.description}</p>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                    <div className="bg-background p-3 rounded-full border-2 border-primary/20 shadow-sm">
                      <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <Card className="border-2 shadow-xl max-w-4xl mx-auto bg-gradient-to-br from-card to-muted/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
            <CardContent className="p-12 text-center relative">
              <Badge variant="outline" className="mb-6 px-4 py-2">
                <Star className="mr-2 h-4 w-4" />
                Ready to Get Started?
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                Ready to Launch Your Token?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Join the growing ecosystem of professional token creators. Launch your token with 
                automated marketplace listing and enterprise-grade infrastructure.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" className="text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" asChild>
                  <Link href="/launch">
                    <Rocket className="mr-2 h-5 w-5" />
                    Start Building Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto hover:bg-primary/10 border-2 transition-all duration-300 hover:border-primary/50" asChild>
                  <Link href="/marketplace">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Browse Tokens
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-md">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-primary">TokenLaunch</span>
            </div>
            <div className="flex flex-col items-center gap-4 md:flex-row md:gap-8">
              <nav className="flex gap-6">
                <Link href="/launch" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Launch
                </Link>
                <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Marketplace
                </Link>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Dashboard
                </Link>
              </nav>
              <p className="text-sm text-muted-foreground">
                © 2024 TokenLaunch. Professional token infrastructure.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
