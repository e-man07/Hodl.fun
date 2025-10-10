'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus,
  ArrowUpRight, 
  ArrowDownRight,
  Coins,
  BarChart3,
  Clock,
  Star,
  ExternalLink,
  Copy,
  Settings,
  History,
  PieChart,
  Activity
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { formatCurrency, formatNumber, formatPercentage, truncateAddress } from '@/lib/utils';

interface UserToken {
  id: string;
  name: string;
  symbol: string;
  balance: number;
  value: number;
  price: number;
  priceChange24h: number;
  isCreator: boolean;
  createdAt?: string;
  marketCap?: number;
  holders?: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'create';
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  price: number;
  value: number;
  timestamp: string;
  txHash: string;
}

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'created' | 'transactions'>('portfolio');
  
  // Mock user data
  const userAddress = '0x1234567890123456789012345678901234567890';
  
  const mockPortfolio: UserToken[] = [
    {
      id: '1',
      name: 'DeFi Revolution',
      symbol: 'DEFI',
      balance: 15000,
      value: 67.5,
      price: 0.0045,
      priceChange24h: 12.5,
      isCreator: false
    },
    {
      id: '2',
      name: 'GameFi Token',
      symbol: 'GAME',
      balance: 8500,
      value: 27.2,
      price: 0.0032,
      priceChange24h: -5.2,
      isCreator: false
    },
    {
      id: '3',
      name: 'My Awesome Token',
      symbol: 'MAT',
      balance: 50000,
      value: 125.0,
      price: 0.0025,
      priceChange24h: 8.7,
      isCreator: true,
      createdAt: '2024-01-15',
      marketCap: 250000,
      holders: 450
    }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      type: 'buy',
      tokenSymbol: 'DEFI',
      tokenName: 'DeFi Revolution',
      amount: 5000,
      price: 0.0042,
      value: 21.0,
      timestamp: '2024-01-20T10:30:00Z',
      txHash: '0xabcd1234...'
    },
    {
      id: '2',
      type: 'create',
      tokenSymbol: 'MAT',
      tokenName: 'My Awesome Token',
      amount: 50000,
      price: 0.0025,
      value: 125.0,
      timestamp: '2024-01-15T14:20:00Z',
      txHash: '0xefgh5678...'
    },
    {
      id: '3',
      type: 'sell',
      tokenSymbol: 'GAME',
      tokenName: 'GameFi Token',
      amount: 2000,
      price: 0.0035,
      value: 7.0,
      timestamp: '2024-01-18T09:15:00Z',
      txHash: '0xijkl9012...'
    }
  ];

  const createdTokens = mockPortfolio.filter(token => token.isCreator);
  const totalPortfolioValue = mockPortfolio.reduce((sum, token) => sum + token.value, 0);
  const totalPnL = mockPortfolio.reduce((sum, token) => {
    const change = (token.priceChange24h / 100) * token.value;
    return sum + change;
  }, 0);
  const totalPnLPercentage = (totalPnL / totalPortfolioValue) * 100;

  const stats = {
    totalValue: totalPortfolioValue,
    totalPnL: totalPnL,
    totalPnLPercentage: totalPnLPercentage,
    tokensOwned: mockPortfolio.length,
    tokensCreated: createdTokens.length,
    totalTransactions: mockTransactions.length
  };

  const TokenRow = ({ token }: { token: UserToken }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
          {token.symbol.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <p className="font-medium">{token.name}</p>
            {token.isCreator && (
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                Creator
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatNumber(token.balance)} {token.symbol}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        <p className="font-medium">{formatCurrency(token.value)}</p>
        <p className={`text-sm flex items-center justify-end ${
          token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
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

  const TransactionRow = ({ transaction }: { transaction: Transaction }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center space-x-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
          transaction.type === 'buy' ? 'bg-green-500' :
          transaction.type === 'sell' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {transaction.type === 'buy' ? <ArrowDownRight className="w-5 h-5" /> :
           transaction.type === 'sell' ? <ArrowUpRight className="w-5 h-5" /> :
           <Plus className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <p className="font-medium capitalize">{transaction.type}</p>
            <Badge variant="outline" className="text-xs">
              {transaction.tokenSymbol}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatNumber(transaction.amount)} tokens @ {formatCurrency(transaction.price)}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        <p className="font-medium">{formatCurrency(transaction.value)}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(transaction.timestamp).toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Dashboard
            </h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">{truncateAddress(userAddress)}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Token
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
                <Wallet className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">24h P&L</p>
                  <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL)}
                  </p>
                  <p className={`text-xs ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(Math.abs(stats.totalPnLPercentage))}
                  </p>
                </div>
                {stats.totalPnL >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Owned</p>
                  <p className="text-2xl font-bold">{stats.tokensOwned}</p>
                </div>
                <Coins className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Created</p>
                  <p className="text-2xl font-bold">{stats.tokensCreated}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg w-fit">
          {[
            { key: 'portfolio', label: 'Portfolio', icon: PieChart },
            { key: 'created', label: 'Created Tokens', icon: Star },
            { key: 'transactions', label: 'Transactions', icon: Activity }
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center space-x-2"
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Content based on active tab */}
        {activeTab === 'portfolio' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5" />
                Portfolio Overview
              </CardTitle>
              <CardDescription>
                Your token holdings and their current values
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mockPortfolio.length > 0 ? (
                mockPortfolio.map((token) => (
                  <TokenRow key={token.id} token={token} />
                ))
              ) : (
                <div className="text-center py-12">
                  <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No tokens yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by creating or buying your first token
                  </p>
                  <div className="space-x-2">
                    <Button>Create Token</Button>
                    <Button variant="outline">Browse Marketplace</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'created' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="mr-2 h-5 w-5" />
                Created Tokens
              </CardTitle>
              <CardDescription>
                Tokens you've created and their performance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {createdTokens.length > 0 ? (
                createdTokens.map((token) => (
                  <div key={token.id} className="p-4 border-b last:border-b-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-medium text-lg">{token.name}</h3>
                          <p className="text-sm text-muted-foreground">{token.symbol}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Analytics
                        </Button>
                        <Button size="sm">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Market Cap</p>
                        <p className="font-medium">{formatCurrency(token.marketCap || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Holders</p>
                        <p className="font-medium">{formatNumber(token.holders || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Your Balance</p>
                        <p className="font-medium">{formatNumber(token.balance)} {token.symbol}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No tokens created</h3>
                  <p className="text-muted-foreground mb-4">
                    Launch your first token and start building your community
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Token
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'transactions' && (
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
              {mockTransactions.length > 0 ? (
                mockTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Your trading history will appear here
                  </p>
                  <Button variant="outline">
                    Browse Marketplace
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
