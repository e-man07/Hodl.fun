'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';
import { WalletButton } from '@/components/WalletButton';
import { useContracts } from '@/hooks/useContracts';
import { getTokenAddressFromTx, getTransactionUrl } from '@/utils/getTokenAddress';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Rocket, 
  CheckCircle, 
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  Coins,
  Info, 
  AlertCircle
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { VoteBanner } from '@/components/VoteBanner';

interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  reserveRatio: string;
  website: string;
  twitter: string;
  telegram: string;
  logoFile: File | undefined;
}

const LaunchPage = () => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;
  const { createToken, isLoading, error, clearError } = useContracts();

  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    totalSupply: '10000000',
    reserveRatio: '50',
    website: '',
    twitter: '',
    telegram: '',
    logoFile: undefined
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [stepTransition, setStepTransition] = useState(false);

  // Trigger animation when step changes
  useEffect(() => {
    setStepTransition(true);
    const timer = setTimeout(() => setStepTransition(false), 500);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleInputChange = (field: keyof TokenFormData, value: string | File | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Please upload an image smaller than 5MB');
        return;
      }
    }
    setFormData(prev => ({ ...prev, logoFile: file }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.name.length >= 2 && formData.symbol.length >= 2 && formData.description.length >= 10;
      case 2:
        return parseFloat(formData.totalSupply) >= 1000000 && parseFloat(formData.totalSupply) <= 100000000;
      case 3:
        return parseFloat(formData.reserveRatio) >= 10 && parseFloat(formData.reserveRatio) <= 90;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep) && currentStep < 4) {
      setStepTransition(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
      }, 150);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setStepTransition(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
      }, 150);
    }
  };

  const handleLaunch = async () => {
    if (error) {
      clearError();
    }

    try {
      // Use the connected wallet address
      if (!address) {
        throw new Error('Unable to get user address');
      }

      // Create token parameters with actual user data
      const tokenParams = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description || 'Token created on hodl.fun',
        totalSupply: formData.totalSupply,
        reserveRatio: parseInt(formData.reserveRatio), // Will be converted to basis points in hook
        creator: address,
        socialLinks: {
          website: formData.website,
          twitter: formData.twitter,
          telegram: formData.telegram
        },
        logoFile: formData.logoFile
      };

      console.log('🚀 Launching token with params:', tokenParams);
      
      // Call contract function
      const result = await createToken(tokenParams);
      
      if (result) {
        console.log('✅ Token creation successful! Hash:', result.hash);
        console.log('🔗 Transaction URL:', getTransactionUrl(result.hash));
        
        setTxHash(result.hash);
        setCurrentStep(5); // Go to success step
        
        // Extract token address from transaction (async)
        if (result.tokenAddress) {
          console.log('🎯 Token contract address:', result.tokenAddress);
          setTokenAddress(result.tokenAddress);
        } else {
          // Try to extract from transaction receipt
          console.log('🔍 Extracting token address from transaction...');
          getTokenAddressFromTx(result.hash).then((address) => {
            if (address) {
              console.log('🎯 Token contract address extracted:', address);
              setTokenAddress(address);
            }
          }).catch((error) => {
            console.error('Failed to extract token address:', error);
          });
        }
      } else {
        console.error('❌ Token creation returned null');
        // Error should already be set by the createToken function
      }
    } catch (err) {
      console.error('❌ Token launch failed:', err);
      // Additional error handling if needed
    }
  };

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Token details and branding' },
    { number: 2, title: 'Token Supply', description: 'Configure token economics' },
    { number: 3, title: 'Bonding Curve', description: 'Set pricing parameters' },
    { number: 4, title: 'Review & Launch', description: 'Final review and deployment' }
  ];

  const features = [
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Security First',
      description: 'Battle-tested smart contracts with comprehensive security measures.'
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: 'Bonding Curves',
      description: 'Automated price discovery ensures fair token distribution.'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Instant Trading',
      description: 'Tokens are immediately tradeable upon creation.'
    }
  ];

  // Success state
  if (txHash) {
    return (
      <div className="min-h-screen bg-background">
        <VoteBanner />
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-2xl mx-auto">
            <Card className="p-8 border-2 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardContent className="space-y-6">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold text-green-800 dark:text-green-200 mb-2">
                    Token Launched Successfully!
                  </h2>
                  <p className="text-green-700 dark:text-green-300 mb-4">
                    Your token has been deployed to the Push Chain and is now available on the marketplace.
                  </p>
                </div>
                
                <div className="bg-background rounded-lg p-4 border space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Transaction Hash:</p>
                    <p className="font-mono text-sm break-all">{txHash}</p>
                  </div>
                  
                  {tokenAddress && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Token Contract Address:</p>
                      <p className="font-mono text-sm break-all text-primary">{tokenAddress}</p>
                    </div>
                  )}
                  
                  {!tokenAddress && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Token Contract Address:</p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        🔍 Extracting from transaction... Please wait a moment.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => window.open(getTransactionUrl(txHash), '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    View Transaction
                  </Button>
                  
                  {tokenAddress && (
                    <Button 
                      onClick={() => window.open(`https://donut.push.network/address/${tokenAddress}`, '_blank')}
                      className="flex items-center gap-2"
                      variant="outline"
                    >
                      <ArrowRight className="h-4 w-4" />
                      View Token Contract
                    </Button>
                  )}
                  
                  <Button variant="outline" asChild>
                    <Link href="/marketplace">
                      <Coins className="h-4 w-4 mr-2" />
                      Go to Marketplace
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VoteBanner />
      <Navbar />

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <Badge variant="secondary" className="mb-4 md:mb-6 px-4 py-2 hover:scale-105 transition-transform duration-300">
            <Rocket className="mr-2 h-4 w-4" />
            Professional Token Platform
          </Badge>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 md:mb-4">
            Launch Your <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Token</span>
          </h1>

          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-6 md:mb-8 px-4">
            Create and deploy your ERC20 token with automated marketplace listing and bonding curve liquidity.
            Built for professionals on Push Chain.
          </p>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="text-center mb-8 max-w-md mx-auto">
            <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                      Wallet Connection Required
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Connect your wallet to start launching tokens
                    </p>
                  </div>
                  <WalletButton />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Form - Only show when wallet is connected */}
        {isConnected && (
          <div className="flex flex-col lg:flex-row gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Main Form */}
            <div className="flex-1 lg:flex-[2]">
              {/* Progress Stepper */}
              <div className="mb-6 md:mb-8">
                <div className="flex items-start justify-between max-w-3xl mx-auto">
                  {steps.map((step, index) => (
                    <React.Fragment key={step.number}>
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-500 ${
                          currentStep > step.number
                            ? 'bg-primary text-primary-foreground scale-110'
                            : currentStep === step.number
                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {currentStep > step.number ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            step.number
                          )}
                        </div>
                        <div className="mt-2 text-center w-20 md:w-24">
                          <p className={`text-xs font-medium transition-colors leading-tight ${
                            currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {step.title}
                          </p>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`h-1 flex-1 mt-5 md:mt-6 mx-2 rounded-full transition-all duration-500 ${
                          currentStep > step.number ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <Card className="border-2 border-border hover:border-primary/30 bg-card transition-all duration-500 shadow-lg">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl md:text-2xl text-foreground">Create Token</CardTitle>
                    <CardDescription className="text-sm md:text-base mt-1">
                      {steps[currentStep - 1].description}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm font-semibold">
                    {currentStep}/{steps.length}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-6 md:p-8">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className={`space-y-6 transition-all duration-500 ${
                    stepTransition ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                  }`}>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2.5 animate-in fade-in slide-in-from-left-3 duration-500">
                        <Label htmlFor="name" className="text-sm font-semibold">Token Name *</Label>
                        <Input
                          id="name"
                          placeholder="e.g., My Awesome Token"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          The full name of your token (2-50 characters)
                        </p>
                      </div>

                      <div className="space-y-2.5 animate-in fade-in slide-in-from-right-3 duration-500 delay-75">
                        <Label htmlFor="symbol" className="text-sm font-semibold">Token Symbol *</Label>
                        <Input
                          id="symbol"
                          placeholder="e.g., MAT"
                          value={formData.symbol}
                          onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                          maxLength={10}
                          className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Short identifier for your token (2-10 characters)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
                      <Label htmlFor="description" className="text-sm font-semibold">Description *</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your token's purpose, utility, and vision..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        rows={4}
                        className="resize-none transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.01] hover:border-primary/50"
                      />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Detailed description of your token (minimum 10 characters)
                      </p>
                    </div>

                    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200">
                      <Label htmlFor="logo" className="text-sm font-semibold">Token Logo (Optional)</Label>
                      {!formData.logoFile ? (
                        <div className="transition-all duration-300 hover:scale-[1.01]">
                          <Input
                            id="logo"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="cursor-pointer transition-all duration-300 hover:border-primary/50"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20 animate-in fade-in zoom-in-95 duration-300 hover:border-primary/40 hover:shadow-md transition-all">
                          <Image
                            src={URL.createObjectURL(formData.logoFile)}
                            alt="Token logo preview"
                            width={56}
                            height={56}
                            className="rounded-full object-cover border-2 border-primary/30 shadow-md"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{formData.logoFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(formData.logoFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleInputChange('logoFile', undefined)}
                            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Upload a logo for your token (JPEG, PNG, GIF, or WebP, max 5MB)
                      </p>
                    </div>

                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
                      <Label className="text-sm font-semibold">Social Links (Optional)</Label>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="website" className="text-sm text-muted-foreground">Website</Label>
                          <Input
                            id="website"
                            placeholder="https://yourwebsite.com"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                          />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="twitter" className="text-sm text-muted-foreground">Twitter</Label>
                            <Input
                              id="twitter"
                              placeholder="@yourusername"
                              value={formData.twitter}
                              onChange={(e) => handleInputChange('twitter', e.target.value)}
                              className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="telegram" className="text-sm text-muted-foreground">Telegram</Label>
                            <Input
                              id="telegram"
                              placeholder="@yourtelegram"
                              value={formData.telegram}
                              onChange={(e) => handleInputChange('telegram', e.target.value)}
                              className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Token Supply */}
                {currentStep === 2 && (
                  <div className={`space-y-6 transition-all duration-500 ${
                    stepTransition ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                  }`}>
                    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500">
                      <Label htmlFor="totalSupply" className="text-sm font-semibold">Total Supply *</Label>
                      <Input
                        id="totalSupply"
                        type="number"
                        placeholder="10000000"
                        value={formData.totalSupply}
                        onChange={(e) => handleInputChange('totalSupply', e.target.value)}
                        min="1000000"
                        max="100000000"
                        className="h-11 text-lg font-medium transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:scale-[1.02] hover:border-primary/50"
                      />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Total number of tokens (1M - 100M tokens)
                      </p>
                    </div>

                    <Card className="bg-primary/5 border-primary/20 hover:border-primary/30 transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Info className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-3 text-foreground">Token Supply Guidelines</h4>
                            <ul className="text-sm text-muted-foreground space-y-2">
                              <li className="flex items-start">
                                <span className="text-primary mr-2">•</span>
                                <span>Minimum: 1,000,000 tokens</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-primary mr-2">•</span>
                                <span>Maximum: 100,000,000 tokens</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-primary mr-2">•</span>
                                <span>Tokens will be minted as needed during bonding curve phase</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-primary mr-2">•</span>
                                <span>No additional tokens can be minted after deployment</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="p-5 border-2 hover:border-primary/30 hover:shadow-md transition-all duration-300 group animate-in fade-in slide-in-from-left-3 duration-500 delay-200 hover:scale-105 cursor-pointer">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                            <Coins className="h-6 w-6 text-primary" />
                          </div>
                          <h4 className="font-semibold mb-1 text-foreground">Creation Fee</h4>
                          <p className="text-2xl font-bold text-primary mb-1">0.01 ETH</p>
                          <p className="text-xs text-muted-foreground">One-time deployment cost</p>
                        </div>
                      </Card>

                      <Card className="p-5 border-2 hover:border-green-500/30 hover:shadow-md transition-all duration-300 group animate-in fade-in slide-in-from-right-3 duration-500 delay-300 hover:scale-105 cursor-pointer">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                            <TrendingUp className="h-6 w-6 text-green-500" />
                          </div>
                          <h4 className="font-semibold mb-1 text-foreground">Platform Fee</h4>
                          <p className="text-2xl font-bold text-green-500 mb-1">1.5%</p>
                          <p className="text-xs text-muted-foreground">On trading volume</p>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Step 3: Bonding Curve Configuration */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reserveRatio" className="text-sm font-semibold">Reserve Ratio</Label>
                        <Badge variant="secondary" className="text-lg font-bold px-4 py-1 transition-all duration-300 hover:scale-110">{formData.reserveRatio}%</Badge>
                      </div>
                      <input
                        id="reserveRatio"
                        type="range"
                        min="10"
                        max="90"
                        value={formData.reserveRatio}
                        onChange={(e) => handleInputChange('reserveRatio', e.target.value)}
                        className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer slider accent-primary hover:accent-primary/80 transition-all hover:h-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          10% (Higher volatility)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          90% (Lower volatility)
                        </span>
                      </div>
                    </div>

                    <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/5 border-primary/20 hover:border-primary/30 transition-colors">
                      <CardContent className="pt-6">
                        <h4 className="font-semibold mb-5 text-foreground flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          Bonding Curve Preview
                        </h4>
                        <div className="grid md:grid-cols-3 gap-4 text-center">
                          <div className="p-4 rounded-lg bg-background/50 hover:bg-background transition-colors">
                            <p className="text-xs text-muted-foreground mb-2">Initial Price</p>
                            <p className="text-xl font-bold text-foreground">0.001 ETH</p>
                          </div>
                          <div className="p-4 rounded-lg bg-background/50 hover:bg-background transition-colors">
                            <p className="text-xs text-muted-foreground mb-2">Liquidity Threshold</p>
                            <p className="text-xl font-bold text-foreground">100 ETH</p>
                          </div>
                          <div className="p-4 rounded-lg bg-background/50 hover:bg-background transition-colors">
                            <p className="text-xs text-muted-foreground mb-2">Reserve Ratio</p>
                            <p className="text-xl font-bold text-primary">{formData.reserveRatio}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/30 border-2 hover:border-blue-500/20 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex-shrink-0">
                            <Info className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-3 text-foreground">Reserve Ratio Explained</h4>
                            <ul className="text-sm text-muted-foreground space-y-2.5">
                              <li className="flex items-start">
                                <span className="text-orange-500 mr-2">•</span>
                                <span><strong className="text-foreground">Lower ratios (10-30%)</strong>: Higher price volatility, faster price changes</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-blue-500 mr-2">•</span>
                                <span><strong className="text-foreground">Medium ratios (40-60%)</strong>: Balanced volatility and stability</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-green-500 mr-2">•</span>
                                <span><strong className="text-foreground">Higher ratios (70-90%)</strong>: Lower volatility, more stable pricing</span>
                              </li>
                              <li className="flex items-start">
                                <span className="text-primary mr-2">•</span>
                                <span><strong className="text-foreground">Recommended:</strong> 50% for most use cases</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Step 4: Review & Launch */}
                {currentStep === 4 && (
                  <div className={`space-y-6 transition-all duration-500 ${
                    stepTransition ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                  }`}>
                    <Card className="border-2 border-primary/20 hover:border-primary/30 transition-colors">
                      <CardHeader className="bg-primary/5">
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500 border border-green-500/20">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          Review Token Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 pt-6">
                        {/* Logo Preview */}
                        {formData.logoFile && (
                          <div className="flex items-center space-x-4 p-5 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border-2 border-primary/20">
                            <Image
                              src={URL.createObjectURL(formData.logoFile)}
                              alt="Token logo"
                              width={72}
                              height={72}
                              className="rounded-full object-cover border-2 border-primary/30 shadow-lg"
                            />
                            <div>
                              <p className="font-bold text-lg text-foreground">{formData.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">${formData.symbol}</p>
                            </div>
                          </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-5">
                          <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1.5">Token Name</p>
                            <p className="font-semibold text-foreground">{formData.name}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1.5">Symbol</p>
                            <p className="font-semibold text-foreground font-mono">{formData.symbol}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1.5">Total Supply</p>
                            <p className="font-semibold text-foreground">{parseInt(formData.totalSupply).toLocaleString()} tokens</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1.5">Reserve Ratio</p>
                            <p className="font-semibold text-primary">{formData.reserveRatio}%</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                          <p className="text-xs text-muted-foreground mb-2">Description</p>
                          <p className="font-medium text-foreground leading-relaxed">{formData.description}</p>
                        </div>
                        
                        {/* Social Links */}
                        {(formData.website || formData.twitter || formData.telegram) && (
                          <div className="p-4 rounded-lg bg-muted/30 border hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground mb-3">Social Links</p>
                            <div className="space-y-2">
                              {formData.website && (
                                <p className="text-sm text-foreground"><strong className="text-muted-foreground">Website:</strong> {formData.website}</p>
                              )}
                              {formData.twitter && (
                                <p className="text-sm text-foreground"><strong className="text-muted-foreground">Twitter:</strong> {formData.twitter}</p>
                              )}
                              {formData.telegram && (
                                <p className="text-sm text-foreground"><strong className="text-muted-foreground">Telegram:</strong> {formData.telegram}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10 border-2 border-primary/30 hover:border-primary/40 transition-all shadow-lg hover:shadow-xl">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30 flex-shrink-0 animate-pulse">
                            <Rocket className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground mb-2 text-lg">Ready to Launch!</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Your token will be deployed and automatically listed on our marketplace with bonding curve liquidity.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-border/50">
                  {currentStep > 1 ? (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="hover:bg-muted transition-colors"
                    >
                      Previous
                    </Button>
                  ) : (
                    <div></div>
                  )}

                  {currentStep < 4 ? (
                    <Button
                      onClick={handleNext}
                      disabled={!validateStep(currentStep)}
                      className="hover:scale-105 transition-transform duration-300"
                      size="lg"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLaunch}
                      disabled={isLoading}
                      size="lg"
                      className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/80"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                          Launching...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-5 w-5" />
                          Launch Token
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex-1 lg:flex-[1] flex flex-col space-y-6">
            {/* Features */}
            <Card className="border-2 hover:border-primary/30 transition-all duration-300 h-fit shadow-md hover:shadow-lg">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Why Choose Our Platform?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3 group hover:translate-x-1 transition-transform duration-300">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground mb-1">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card className="border-2 hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-muted/30 to-muted/10 h-fit shadow-md hover:shadow-lg">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 hover:bg-background transition-colors">
                  <span className="text-sm font-medium text-muted-foreground">Creation Fee</span>
                  <span className="font-semibold text-foreground">0.01 ETH</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 hover:bg-background transition-colors">
                  <span className="text-sm font-medium text-muted-foreground">Gas Fees</span>
                  <span className="font-semibold text-foreground">~0.02 ETH</span>
                </div>
                <div className="border-t-2 border-primary/20 pt-4 flex justify-between items-center p-3 rounded-lg bg-primary/5">
                  <span className="font-semibold text-foreground">Total Cost</span>
                  <span className="text-xl font-bold text-primary">~0.03 ETH</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t">
                  Gas fees may vary based on network conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default LaunchPage;
