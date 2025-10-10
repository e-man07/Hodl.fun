'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button as RetroButton, Card as RetroCard } from 'pixel-retroui';
// import { usePushWalletContext, PushUniversalAccountButton } from '@pushchain/ui-kit';
// import { useContracts } from '@/hooks/useContracts';

import { useWallet } from '@/hooks/useWallet';
import { WalletButton } from '@/components/WalletButton';
import { useRealContracts } from '@/hooks/useRealContracts';
import { IPFSStatus } from '@/components/IPFSStatus';
interface TokenParams {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  metadataURI: string;
  reserveRatio: number;
  creator: string;
  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
  logoFile?: File;
}

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Rocket, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  TrendingUp, 
  Zap, 
  Info, 
  Coins, 
  ArrowRight 
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  reserveRatio: string;
  website: string;
  twitter: string;
  telegram: string;
  logoFile: File | null;
}

const LaunchPage = () => {
  const { isConnected, address, isCorrectNetwork } = useWallet();
  const { createToken, isLoading, error, clearError } = useRealContracts();
  
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    totalSupply: '10000000',
    reserveRatio: '50',
    website: '',
    twitter: '',
    telegram: '',
    logoFile: null
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleInputChange = (field: keyof TokenFormData, value: string | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
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
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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
      const tokenParams: TokenParams = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        totalSupply: formData.totalSupply,
        metadataURI: '', // Will be set by the contract hook after IPFS upload
        reserveRatio: parseInt(formData.reserveRatio) * 100, // Convert to basis points
        creator: address,
        socialLinks: {
          website: formData.website,
          twitter: formData.twitter,
          telegram: formData.telegram
        },
        logoFile: formData.logoFile || undefined
      };

      // Call contract function
      const hash = await createToken(tokenParams);
      
      if (hash) {
        setTxHash(hash);
        setCurrentStep(5); // Go to success step
      }
    } catch (err) {
      console.error('Token launch failed:', err);
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
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-black">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <RetroCard className="max-w-2xl mx-auto p-8 bg-green-500 border-8 border-white">
              <CheckCircle className="h-16 w-16 text-white mx-auto mb-4" />
              <h2 className="text-3xl font-minecraft text-white font-bold mb-4">
                🎉 TOKEN LAUNCHED SUCCESSFULLY! 🎉
              </h2>
              <p className="font-minecraft text-white mb-4">
                Transaction Hash: {txHash}
              </p>
              <RetroButton 
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 border-4 border-white font-minecraft"
                onClick={() => window.open(`https://donut.push.network/tx/${txHash}`, '_blank')}
              >
                🔍 VIEW ON EXPLORER
              </RetroButton>
            </RetroCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-black">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <RetroCard className="inline-block p-4 bg-yellow-400 border-4 border-black mb-6">
            <div className="flex items-center space-x-2">
              <Rocket className="h-6 w-6 text-black" />
              <span className="font-minecraft text-black font-bold">TOKEN LAUNCHPAD</span>
            </div>
          </RetroCard>
          
          <h1 className="text-5xl font-bold font-minecraft text-white mb-4 drop-shadow-lg">
            🚀 LAUNCH YOUR TOKEN 🚀
          </h1>
          <RetroCard className="max-w-2xl mx-auto p-6 bg-black border-4 border-cyan-400">
            <p className="text-lg text-cyan-400 font-minecraft font-bold">
              Create and deploy your ERC20 token with automated marketplace listing and bonding curve liquidity!
            </p>
          </RetroCard>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="text-center mb-8">
            <RetroCard className="inline-block p-6 bg-red-600 border-4 border-white">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-6 w-6 text-white" />
                <span className="font-minecraft text-white font-bold">CONNECT WALLET TO CONTINUE</span>
              </div>
            </RetroCard>
            <div className="mt-4">
              <WalletButton />
            </div>
          </div>
        )}

        {/* Wrong Network Warning */}
        {isConnected && !isCorrectNetwork && (
          <div className="text-center mb-8">
            <RetroCard className="inline-block p-6 bg-orange-600 border-4 border-white">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-6 w-6 text-white" />
                <span className="font-minecraft text-white font-bold">SWITCH TO PUSH CHAIN NETWORK</span>
              </div>
            </RetroCard>
            <div className="mt-4">
              <WalletButton />
            </div>
          </div>
        )}

        {/* Connected Status */}
        {isConnected && isCorrectNetwork && (
          <div className="text-center mb-8 space-y-4">
            <RetroCard className="inline-block p-4 bg-green-600 border-4 border-white">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-white" />
                <span className="font-minecraft text-white font-bold">WALLET CONNECTED - READY TO LAUNCH!</span>
              </div>
            </RetroCard>
            
            {/* IPFS Status */}
            <div className="max-w-md mx-auto">
              <IPFSStatus />
            </div>
          </div>
        )}

        {/* Main Form - Only show when wallet is connected and on correct network */}
        {isConnected && isCorrectNetwork && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Create Token</CardTitle>
                    <CardDescription>
                      Step {currentStep} of {steps.length}: {steps[currentStep - 1].description}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {currentStep}/{steps.length}
                  </Badge>
                </div>
                
                {/* Progress Steps */}
                <div className="flex items-center justify-between mt-6">
                  {steps.map((step, index) => (
                    <div key={step.number} className="flex items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                        currentStep >= step.number 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {currentStep > step.number ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          step.number
                        )}
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`h-0.5 w-16 ml-2 ${
                          currentStep > step.number ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Token Name *</Label>
                        <Input
                          id="name"
                          placeholder="e.g., My Awesome Token"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          The full name of your token (2-50 characters)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="symbol">Token Symbol *</Label>
                        <Input
                          id="symbol"
                          placeholder="e.g., MAT"
                          value={formData.symbol}
                          onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                          maxLength={10}
                        />
                        <p className="text-xs text-muted-foreground">
                          Short identifier for your token (2-10 characters)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your token's purpose, utility, and vision..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Detailed description of your token (minimum 10 characters)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logo">Token Logo (Optional)</Label>
                      <div className="flex items-center space-x-4">
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                        />
                        {formData.logoFile && (
                          <div className="flex items-center space-x-2">
                            <Image
                              src={URL.createObjectURL(formData.logoFile)}
                              alt="Token logo preview"
                              width={48}
                              height={48}
                              className="rounded-full object-cover border-2 border-border"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleInputChange('logoFile', null)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a logo for your token (JPEG, PNG, GIF, or WebP, max 5MB)
                      </p>
                    </div>

                    <div className="space-y-4">
                      <Label>Social Links (Optional)</Label>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="website" className="text-sm">Website</Label>
                          <Input
                            id="website"
                            placeholder="https://yourwebsite.com"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="twitter" className="text-sm">Twitter</Label>
                          <Input
                            id="twitter"
                            placeholder="@yourusername"
                            value={formData.twitter}
                            onChange={(e) => handleInputChange('twitter', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telegram" className="text-sm">Telegram</Label>
                          <Input
                            id="telegram"
                            placeholder="@yourtelegram"
                            value={formData.telegram}
                            onChange={(e) => handleInputChange('telegram', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Token Supply */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="totalSupply">Total Supply *</Label>
                      <Input
                        id="totalSupply"
                        type="number"
                        placeholder="10000000"
                        value={formData.totalSupply}
                        onChange={(e) => handleInputChange('totalSupply', e.target.value)}
                        min="1000000"
                        max="100000000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Total number of tokens (1M - 100M tokens)
                      </p>
                    </div>

                    <Card className="bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium mb-2">Token Supply Guidelines</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• Minimum: 1,000,000 tokens</li>
                              <li>• Maximum: 100,000,000 tokens</li>
                              <li>• Tokens will be minted as needed during bonding curve phase</li>
                              <li>• No additional tokens can be minted after deployment</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <div className="text-center">
                          <Coins className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <h4 className="font-medium">Creation Fee</h4>
                          <p className="text-2xl font-bold text-primary">0.01 ETH</p>
                          <p className="text-xs text-muted-foreground">One-time deployment cost</p>
                        </div>
                      </Card>
                      
                      <Card className="p-4">
                        <div className="text-center">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <h4 className="font-medium">Platform Fee</h4>
                          <p className="text-2xl font-bold text-green-500">1.5%</p>
                          <p className="text-xs text-muted-foreground">On trading volume</p>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Step 3: Bonding Curve Configuration */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="reserveRatio">Reserve Ratio: {formData.reserveRatio}%</Label>
                      <input
                        id="reserveRatio"
                        type="range"
                        min="10"
                        max="90"
                        value={formData.reserveRatio}
                        onChange={(e) => handleInputChange('reserveRatio', e.target.value)}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>10% (Higher volatility)</span>
                        <span>90% (Lower volatility)</span>
                      </div>
                    </div>

                    <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-4">Bonding Curve Preview</h4>
                        <div className="grid md:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Initial Price</p>
                            <p className="text-lg font-semibold">0.001 ETH</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Liquidity Threshold</p>
                            <p className="text-lg font-semibold">100 ETH</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Reserve Ratio</p>
                            <p className="text-lg font-semibold">{formData.reserveRatio}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium mb-2">Reserve Ratio Explained</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• <strong>Lower ratios (10-30%)</strong>: Higher price volatility, faster price changes</li>
                              <li>• <strong>Medium ratios (40-60%)</strong>: Balanced volatility and stability</li>
                              <li>• <strong>Higher ratios (70-90%)</strong>: Lower volatility, more stable pricing</li>
                              <li>• Recommended: 50% for most use cases</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Step 4: Review & Launch */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                          Review Token Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Logo Preview */}
                        {formData.logoFile && (
                          <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                            <Image
                              src={URL.createObjectURL(formData.logoFile)}
                              alt="Token logo"
                              width={64}
                              height={64}
                              className="rounded-full object-cover border-2 border-border"
                            />
                            <div>
                              <p className="font-medium">{formData.name}</p>
                              <p className="text-sm text-muted-foreground">{formData.symbol}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Token Name</p>
                            <p className="font-medium">{formData.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Symbol</p>
                            <p className="font-medium">{formData.symbol}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Supply</p>
                            <p className="font-medium">{parseInt(formData.totalSupply).toLocaleString()} tokens</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Reserve Ratio</p>
                            <p className="font-medium">{formData.reserveRatio}%</p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground">Description</p>
                          <p className="font-medium">{formData.description}</p>
                        </div>
                        
                        {/* Social Links */}
                        {(formData.website || formData.twitter || formData.telegram) && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Social Links</p>
                            <div className="space-y-1">
                              {formData.website && (
                                <p className="text-sm"><strong>Website:</strong> {formData.website}</p>
                              )}
                              {formData.twitter && (
                                <p className="text-sm"><strong>Twitter:</strong> {formData.twitter}</p>
                              )}
                              {formData.telegram && (
                                <p className="text-sm"><strong>Telegram:</strong> {formData.telegram}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-green-800 mb-2">Ready to Launch!</h4>
                            <p className="text-sm text-green-700">
                              Your token will be deployed and automatically listed on our marketplace with bonding curve liquidity.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t">
                  <Button 
                    variant="outline" 
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                  >
                    Previous
                  </Button>
                  
                  {currentStep < 4 ? (
                    <Button 
                      onClick={handleNext}
                      disabled={!validateStep(currentStep)}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleLaunch}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-primary to-secondary"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Launching...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
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
          <div className="space-y-6">
            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Why Choose Our Platform?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Creation Fee</span>
                  <span className="font-medium">0.01 ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Gas Fees</span>
                  <span className="font-medium">~0.02 ETH</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total Cost</span>
                  <span>~0.03 ETH</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gas fees may vary based on network conditions
                </p>
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Check our documentation or join our community for support.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    View Documentation
                  </Button>
                  <Button variant="outline" size="sm" className="w-full">
                    Join Discord
                  </Button>
                </div>
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
