"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Plus,
  Coins,
  BarChart3,
  Star,
  ExternalLink,
  Copy,
  PieChart,
  Activity,
  RefreshCw,
  Loader2,
  Check,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { VoteBanner } from '@/components/VoteBanner';
import {
  formatCurrency,
  truncateAddress,
} from "@/lib/utils";
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';
import { useUserPortfolio } from "@/hooks/useUserPortfolio";

const DashboardPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"portfolio" | "created">("portfolio");
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Get wallet connection state and user data
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;
  
  // Normalize address to lowercase for consistency
  const normalizedAddress = address?.toLowerCase() || null;
  
  const {
    tokens,
    stats: portfolioStats,
    isLoading,
    error,
    refreshPortfolio,
  } = useUserPortfolio(isConnected && normalizedAddress ? normalizedAddress : null);

  // Get created tokens (user is creator)
  const createdTokens = tokens.filter((token) => token.isCreator);

  // Handle copy address
  const handleCopyAddress = async () => {
    if (normalizedAddress) {
      await navigator.clipboard.writeText(normalizedAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const TokenRow = ({
    token,
  }: {
    token: import("@/hooks/useUserPortfolio").UserToken;
  }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/30 transition-all duration-300 hover:translate-x-1 hover:shadow-sm cursor-pointer group">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-sm group-hover:scale-110 group-hover:border-primary/40 transition-all duration-300">
          {token.symbol.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <p className="font-medium text-foreground">{token.name}</p>
            {token.isCreator && (
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                Creator
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {token.balanceFormatted} {token.symbol}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-medium text-foreground">{formatCurrency(token.value)}</p>
        <p className="text-sm text-muted-foreground">
          @ {formatCurrency(token.price)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <VoteBanner />
      <Navbar />

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <Badge variant="secondary" className="mb-4 px-4 py-2 hover:scale-105 transition-transform duration-300">
              <Activity className="mr-2 h-4 w-4" />
              Portfolio Dashboard
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
              Dashboard
            </h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-mono">
                {normalizedAddress ? truncateAddress(normalizedAddress) : "Not connected"}
              </span>
              {normalizedAddress && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary/10 transition-all duration-300"
                  onClick={handleCopyAddress}
                  title="Copy address"
                >
                  {copiedAddress ? (
                    <Check className="h-3 w-3 text-primary animate-in zoom-in-50 duration-200" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className="flex space-x-3 mt-6 md:mt-0">
            <Button
              onClick={() => router.push('/launch')}
              className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Token
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:scale-105 animate-in fade-in slide-in-from-bottom-3 duration-500 group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Portfolio Value
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(portfolioStats.totalValue)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:scale-105 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75 group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invested</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(portfolioStats.totalValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Across {portfolioStats.tokensOwned} token{portfolioStats.tokensOwned !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <BarChart3 className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-secondary/30 transition-all duration-300 hover:shadow-lg hover:scale-105 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Owned</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioStats.tokensOwned}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <Coins className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:scale-105 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200 group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tokens Created
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioStats.tokensCreated}
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <Star className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg w-fit">
          {[
            { key: "portfolio", label: "Portfolio", icon: PieChart },
            { key: "created", label: "Created Tokens", icon: Star },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() =>
                setActiveTab(tab.key as "portfolio" | "created")
              }
              className="flex items-center space-x-2 transition-all duration-300"
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Content based on active tab */}
        {!isConnected ? (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-4">
                Connect your wallet to view your portfolio and trading activity
              </p>
              <Button asChild>
                <Link href="/">Connect Wallet</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          activeTab === "portfolio" && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <PieChart className="mr-2 h-5 w-5" />
                      Portfolio Overview
                    </CardTitle>
                    <CardDescription>
                      Your token holdings and their current values
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshPortfolio}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${
                        isLoading ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
                    <p className="text-muted-foreground">
                      Loading your portfolio...
                    </p>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <div className="text-red-500 mb-4">
                      Error loading portfolio: {error}
                    </div>
                    <Button variant="outline" onClick={refreshPortfolio}>
                      Try Again
                    </Button>
                  </div>
                ) : tokens.length > 0 ? (
                  tokens.map((token) => (
                    <TokenRow key={token.address} token={token} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No tokens yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by creating or buying your first token
                    </p>
                    <div className="space-x-2">
                      <Button asChild>
                        <Link href="/launch">Create Token</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/marketplace">Browse Marketplace</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        )}

        {isConnected && activeTab === "created" && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="mr-2 h-5 w-5" />
                Created Tokens
              </CardTitle>
              <CardDescription>
                Tokens you have created and their performance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
                  <p className="text-muted-foreground">
                    Loading your created tokens...
                  </p>
                </div>
              ) : createdTokens.length > 0 ? (
                createdTokens.map((token, index) => (
                  <div
                    key={token.address}
                    className={`p-4 border-b last:border-b-0 hover:bg-muted/30 transition-all duration-300 animate-in fade-in slide-in-from-left-3 ${
                      `delay-${index * 100}`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold hover:scale-110 transition-transform duration-300">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-medium text-lg">{token.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {token.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" asChild variant="outline" className="hover:bg-primary/10 transition-colors">
                          <Link href={`/marketplace`}>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View on Marketplace
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current Price</p>
                        <p className="font-medium">
                          {formatCurrency(token.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Cap</p>
                        <p className="font-medium">
                          {formatCurrency(token.marketCap || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Your Balance</p>
                        <p className="font-medium">
                          {token.balanceFormatted} {token.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {token.createdAt
                            ? new Date(token.createdAt).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">
                    No tokens created
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Launch your first token and start building your community
                  </p>
                  <Button asChild>
                    <Link href="/launch">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Token
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};

export default DashboardPage;
