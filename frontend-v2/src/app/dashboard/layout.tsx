import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Hodl.fun',
  description:
    'Manage your token portfolio on Hodl.fun. Track holdings, view P&L, claim creator fees, and monitor your trading activity.',
  openGraph: {
    title: 'Your Dashboard | Hodl.fun',
    description:
      'Manage your token portfolio, track holdings, and claim creator fees on Hodl.fun.',
  },
  robots: {
    index: false, // Dashboard is user-specific, don't index
  },
  alternates: {
    canonical: 'https://www.thehodl.fun/dashboard',
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
