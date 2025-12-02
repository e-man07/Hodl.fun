'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { getIPFSImageUrl } from '@/utils/ipfsImage';

interface Token {
  address: string;
  name: string;
  symbol: string;
  marketCap: number;
  holders: number;
  logo?: string;
}

interface LeaderboardProps {
  tokens: Token[];
  title?: string;
}

export const Leaderboard = ({ tokens, title = 'Top Tokens' }: LeaderboardProps) => {
  const topTokens = tokens
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">🥇</Badge>;
    }
    if (rank === 2) {
      return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-white border-0">🥈</Badge>;
    }
    if (rank === 3) {
      return <Badge className="bg-gradient-to-r from-orange-400 to-orange-600 text-white border-0">🥉</Badge>;
    }
    return <Badge variant="secondary">#{rank}</Badge>;
  };

  return (
    <Card className="border-2 hover:border-primary/30 transition-all">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {topTokens.map((token, index) => (
            <div
              key={token.address}
              className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getRankBadge(index + 1)}
                  </div>
                  
                  {token.logo ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Image
                        src={getIPFSImageUrl(token.logo)}
                        alt={token.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                      {token.symbol.slice(0, 2)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate">{token.name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{formatCurrency(token.marketCap)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{token.holders}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

