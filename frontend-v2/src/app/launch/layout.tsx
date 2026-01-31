import type { Metadata } from 'next';
import { LaunchFAQSchema } from '@/components/seo/json-ld';

export const metadata: Metadata = {
  title: 'Launch Token | Hodl.fun',
  description:
    'Create your own ERC20 token in seconds with bonding curve mechanics on Push Chain. Fair launch with no pre-sale or team allocation.',
  openGraph: {
    title: 'Launch Your Token | Hodl.fun',
    description:
      'Create your own ERC20 token in seconds with bonding curve mechanics on Push Chain.',
  },
  alternates: {
    canonical: 'https://www.thehodl.fun/launch',
  },
};

export default function LaunchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LaunchFAQSchema />
      {children}
    </>
  );
}
