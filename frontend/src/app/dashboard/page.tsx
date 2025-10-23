"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  BarChart3,
  Star,
  ExternalLink,
  Copy,
  Settings,
  History,
  PieChart,
  Activity,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  truncateAddress,
} from "@/lib/utils";
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';
import { useUserPortfolio } from "@/hooks/useUserPortfolio";

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "created" | "transactions"
  >("portfolio");

  // Get wallet connection state and user data
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;
  const {
    tokens,
    stats: portfolioStats,
    isLoading,
    error,
    refreshPortfolio,
  } = useUserPortfolio(isConnected && address ? address : null);

  // Get created tokens (user is creator)
  const createdTokens = tokens.filter((token) => token.isCreator);

  const TokenRow = ({
    token,
  }: {
    token: import("@/hooks/useUserPortfolio").UserToken;
  }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
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
        <p
          className={`text-sm flex items-center justify-end ${
            token.priceChange24h >= 0 ? "text-primary" : "text-destructive"
          }`}
        >
          {token.priceChange24h >= 0 ? (
            <ArrowUpRight className="w-3 h-3 mr-1" />
          ) : (
            <ArrowDownRight className="w-3 h-3 mr-1" />
          )}
          {formatPercentage(Math.abs(token.priceChange24h))}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <Badge variant="secondary" className="mb-4 px-4 py-2">
              <Activity className="mr-2 h-4 w-4" />
              Portfolio Dashboard
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-3 sm:text-5xl">
              Dashboard
            </h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-mono">
                {address ? truncateAddress(address) : "Not connected"}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex space-x-3 mt-6 md:mt-0">
            <Button variant="outline" className="hover:bg-primary/10">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button className="shadow-lg hover:shadow-xl transition-all duration-300">
              <Plus className="mr-2 h-4 w-4" />
              Create Token
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 hover:border-primary/20 transition-colors">
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
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">24h P&L</p>
                  <p
                    className={`text-2xl font-bold ${
                      portfolioStats.totalPnL >= 0
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {portfolioStats.totalPnL >= 0 ? "+" : ""}
                    {formatCurrency(portfolioStats.totalPnL)}
                  </p>
                  <p
                    className={`text-xs ${
                      portfolioStats.totalPnL >= 0
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {formatPercentage(
                      Math.abs(portfolioStats.totalPnLPercentage)
                    )}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  portfolioStats.totalPnL >= 0 
                    ? "bg-primary/10" 
                    : "bg-destructive/10"
                }`}>
                  {portfolioStats.totalPnL >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-primary" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Owned</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioStats.tokensOwned}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Coins className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/20 transition-colors">
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
                <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
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
            { key: "transactions", label: "Transactions", icon: Activity },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() =>
                setActiveTab(
                  tab.key as "portfolio" | "created" | "transactions"
                )
              }
              className="flex items-center space-x-2"
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Content based on active tab */}
        {!isConnected ? (
          <Card>
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
            <Card>
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
          <Card>
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
                createdTokens.map((token) => (
                  <div
                    key={token.address}
                    className="p-4 border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold">
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
                        <Button size="sm" variant="outline">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Analytics
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/marketplace?token=${token.address}`}>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
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
                        <p className="text-muted-foreground">Total Supply</p>
                        <p className="font-medium">
                          {token.totalSupply
                            ? formatNumber(parseFloat(token.balanceFormatted))
                            : "N/A"}
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

        {isConnected && activeTab === "transactions" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Your recent trading and token creation activity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">
                  Transaction History Coming Soon
                </h3>
                <p className="text-muted-foreground mb-4">
                  We are working on bringing you comprehensive transaction
                  history. For now, you can view individual transactions on the
                  block explorer.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/marketplace">Browse Marketplace</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
