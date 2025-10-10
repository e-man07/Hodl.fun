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
  Sparkles
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
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative mx-auto px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              <Sparkles className="mr-2 h-4 w-4" />
              Powered by Bonding Curves
            </Badge>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Launch Your Token
              <span className="block gradient-text">In Minutes</span>
            </h1>
            
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Create, deploy, and trade ERC20 tokens with automated liquidity through bonding curves. 
              No coding required, maximum security guaranteed.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/launch">
                  <Rocket className="mr-2 h-5 w-5" />
                  Launch Token Now
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/marketplace">
                  Explore Marketplace
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-primary sm:text-4xl">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground sm:text-base">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything You Need to Launch
            </h2>
            <p className="text-lg text-muted-foreground">
              Our platform provides all the tools and infrastructure needed for successful token launches.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-secondary text-white mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Launch your token in three simple steps with our automated platform.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-white text-xl font-bold mb-6">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full">
                    <ArrowRight className="h-6 w-6 text-muted-foreground mx-auto" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <Card className="border-0 bg-gradient-to-r from-primary/10 to-secondary/10 shadow-2xl">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Ready to Launch Your Token?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of creators who have successfully launched their tokens on our platform. 
                Start building your community today.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" className="text-lg px-8 py-6" asChild>
                  <Link href="/launch">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                  <Link href="/marketplace">
                    View Marketplace
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-secondary">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">TokenLaunch</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 TokenLaunch. Built with security and innovation in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
