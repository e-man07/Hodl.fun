import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard | Hodl.fun',
  description:
    'Discover top performing tokens on Hodl.fun. Track gainers, losers, volume leaders, and newly graduated tokens on Push Chain.',
  openGraph: {
    title: 'Token Leaderboard | Hodl.fun',
    description:
      'Discover top performing tokens on Hodl.fun. Track gainers, losers, and volume leaders.',
  },
  alternates: {
    canonical: 'https://www.thehodl.fun/leaderboard',
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
