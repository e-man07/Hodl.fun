'use client';

import React, { useState } from 'react';
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
  Coins,
  Info, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  Twitter,
  MessageCircle
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

  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [showSocialFields, setShowSocialFields] = useState(false);

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

  const validateForm = (): boolean => {
    return formData.name.length >= 2 && 
           formData.symbol.length >= 2 && 
           formData.description.length >= 10;
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


  // Success state
  if (txHash) {
    return (
      <div className="min-h-screen bg-background">
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
      <Navbar />

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <Badge variant="outline" className="mb-4 px-4 py-2 hover:scale-105 transition-transform duration-300 bg-primary/15 text-primary/90 border-primary/30">
            <Rocket className="mr-2 h-4 w-4" />
            Launch Token
          </Badge>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 md:mb-4">
            Launch Your <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Token</span>
          </h1>

          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-6 md:mb-8 px-4">
            Create your token in seconds. Fill in the basics and launch! 🚀
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

        {/* Main Form - Single Page */}
        {isConnected && (
          <div className="flex flex-col lg:flex-row gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Main Form */}
            <div className="flex-1 lg:flex-[2]">
              <Card className="border-2 border-primary/30 bg-card shadow-xl">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Zap className="h-6 w-6 text-primary" />
                    Create Your Token
                  </CardTitle>
                  <CardDescription>
                    Fill in the details and launch your token
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {/* Basic Fields */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Token Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., DogeCoin"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="symbol">Symbol *</Label>
                      <Input
                        id="symbol"
                        placeholder="DOGE"
                        value={formData.symbol}
                        onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                        maxLength={10}
                        className="h-12"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="The best meme token ever..."
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Logo Upload with Preview */}
                  <div className="space-y-2">
                    <Label htmlFor="logo">Logo (Optional)</Label>
                    {!formData.logoFile ? (
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="cursor-pointer"
                      />
                    ) : (
                      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20">
                        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30">
                          <Image
                            src={URL.createObjectURL(formData.logoFile)}
                            alt="Token logo preview"
                            fill
                            className="object-cover"
                          />
                        </div>
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
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Social Fields */}
                  <div className="border rounded-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto"
                      onClick={() => setShowSocialFields(!showSocialFields)}
                    >
                      <span className="font-semibold">Website & Social Links (Optional)</span>
                      {showSocialFields ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    {showSocialFields && (
                      <div className="px-4 pb-4 space-y-4 border-t pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="website" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Website
                          </Label>
                          <Input
                            id="website"
                            placeholder="https://yourwebsite.com"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                          />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="twitter" className="flex items-center gap-2">
                              <Twitter className="h-4 w-4" />
                              Twitter
                            </Label>
                            <Input
                              id="twitter"
                              placeholder="@yourusername"
                              value={formData.twitter}
                              onChange={(e) => handleInputChange('twitter', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="telegram" className="flex items-center gap-2">
                              <MessageCircle className="h-4 w-4" />
                              Telegram
                            </Label>
                            <Input
                              id="telegram"
                              placeholder="@yourtelegram"
                              value={formData.telegram}
                              onChange={(e) => handleInputChange('telegram', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Default Settings Info */}
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Total Supply</span>
                      <span className="font-bold">{parseInt(formData.totalSupply).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reserve Ratio</span>
                      <span className="font-bold">{formData.reserveRatio}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Using default settings: 10M supply, 50% reserve ratio
                    </p>
                  </div>

                  {/* Launch Button */}
                  <Button
                    onClick={handleLaunch}
                    disabled={isLoading || !validateForm()}
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-transform text-lg font-bold py-6"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-5 w-5" />
                        Launch Token Now 🚀
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Preview */}
            <div className="flex-1 lg:flex-[1]">
              <Card className="border-2 hover:border-primary/30 transition-all sticky top-4">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    Token Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* Logo Preview */}
                  {formData.logoFile ? (
                    <div className="flex justify-center">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30">
                        <Image
                          src={URL.createObjectURL(formData.logoFile)}
                          alt="Token logo"
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-xl">
                        {formData.symbol.slice(0, 2) || '??'}
                      </div>
                    </div>
                  )}

                  {/* Token Info */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Token Name</p>
                      <p className="font-bold text-lg">{formData.name || 'Your Token Name'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Symbol</p>
                      <p className="font-mono font-bold">{formData.symbol || 'SYMBOL'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm line-clamp-3">{formData.description || 'Token description will appear here...'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Supply</p>
                        <p className="font-semibold">{parseInt(formData.totalSupply).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Reserve Ratio</p>
                        <p className="font-semibold text-primary">{formData.reserveRatio}%</p>
                      </div>
                    </div>

                    {/* Social Links Preview */}
                    {(formData.website || formData.twitter || formData.telegram) && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Social Links</p>
                        <div className="space-y-1">
                          {formData.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-3 w-3" />
                              <span className="truncate">{formData.website}</span>
                            </div>
                          )}
                          {formData.twitter && (
                            <div className="flex items-center gap-2 text-sm">
                              <Twitter className="h-3 w-3" />
                              <span>{formData.twitter}</span>
                            </div>
                          )}
                          {formData.telegram && (
                            <div className="flex items-center gap-2 text-sm">
                              <MessageCircle className="h-3 w-3" />
                              <span>{formData.telegram}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cost Breakdown */}
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Estimated Cost</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Creation Fee</span>
                          <span className="font-semibold">0.01 ETH</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Gas Fees</span>
                          <span className="font-semibold">~0.02 ETH</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t font-bold">
                          <span>Total</span>
                          <span className="text-primary">~0.03 ETH</span>
                        </div>
                      </div>
                    </div>
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
