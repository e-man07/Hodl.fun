import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TokenContent, TokenPageSkeleton } from '@/components/token/token-content';

interface TokenPageProps {
  params: Promise<{ address: string }>;
}

// Fetch token data for metadata generation
async function getToken(address: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${apiUrl}/tokens/${address}`, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// Format wei to human readable for metadata
function formatPrice(weiString: string): string {
  const wei = BigInt(weiString);
  const divisor = BigInt(10 ** 18);
  const value = Number(wei) / Number(divisor);
  return value.toFixed(8);
}

export async function generateMetadata({ params }: TokenPageProps): Promise<Metadata> {
  const { address } = await params;
  const token = await getToken(address);

  if (!token) {
    return {
      title: 'Token Not Found | Hodl.fun',
      description: 'The requested token could not be found on Hodl.fun.',
    };
  }

  const price = formatPrice(token.price);
  const description = token.metadata?.description
    ? `${token.metadata.description.slice(0, 150)}...`
    : `Trade ${token.name} (${token.symbol}) on Hodl.fun with bonding curve mechanics.`;

  return {
    title: `${token.name} (${token.symbol}) Price & Trading | Hodl.fun`,
    description: `${token.name} current price: ${price} PUSH. ${description}`,
    keywords: `${token.name}, ${token.symbol}, token, crypto, push chain, trading, ${token.symbol.toLowerCase()} price`,
    openGraph: {
      title: `${token.name} (${token.symbol}) | Hodl.fun`,
      description: `Trade ${token.name} on Hodl.fun. Current price: ${price} PUSH.`,
      url: `https://www.thehodl.fun/token/${address}`,
      images: token.metadata?.image
        ? [
            {
              url: token.metadata.image.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${token.metadata.image.replace('ipfs://', '')}`
                : token.metadata.image,
              width: 400,
              height: 400,
              alt: `${token.name} token logo`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${token.name} (${token.symbol}) | Hodl.fun`,
      description: `Trade ${token.name} on Hodl.fun. Current price: ${price} PUSH.`,
    },
    alternates: {
      canonical: `https://www.thehodl.fun/token/${address}`,
    },
  };
}

// Server Component - no 'use client' directive
// This allows Next.js to optimize initial rendering and streaming
export default async function TokenPage({ params }: TokenPageProps) {
  const { address } = await params;

  return (
    <Suspense fallback={<TokenPageSkeleton />}>
      <TokenContent address={address} />
    </Suspense>
  );
}
