import type { Token } from '@/types';

interface JsonLdProps {
  data: Record<string, unknown>;
}

function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Organization schema for the website
 */
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hodl.fun',
    url: 'https://www.thehodl.fun',
    logo: 'https://www.thehodl.fun/hodl-logo.png',
    description: 'Token launchpad platform on Push Chain with bonding curve mechanics',
    sameAs: ['https://x.com/thehodldotfun'],
  };

  return <JsonLd data={schema} />;
}

/**
 * WebSite schema with search action
 */
export function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Hodl.fun',
    url: 'https://www.thehodl.fun',
    description: 'Create and trade ERC20 tokens with bonding curve mechanics on Push Chain',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.thehodl.fun/?search={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <JsonLd data={schema} />;
}

/**
 * Product schema for individual token pages
 */
interface TokenSchemaProps {
  token: Token;
  price: number;
  marketCap: number;
}

export function TokenSchema({ token, price, marketCap }: TokenSchemaProps) {
  const imageUrl = token.metadata?.image
    ? token.metadata.image.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${token.metadata.image.replace('ipfs://', '')}`
      : token.metadata.image
    : undefined;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${token.name} (${token.symbol})`,
    description: token.metadata?.description || `${token.name} token on Hodl.fun`,
    image: imageUrl,
    url: `https://www.thehodl.fun/token/${token.address}`,
    brand: {
      '@type': 'Brand',
      name: 'Hodl.fun',
    },
    offers: {
      '@type': 'Offer',
      price: price.toFixed(8),
      priceCurrency: 'PUSH',
      availability: 'https://schema.org/InStock',
      url: `https://www.thehodl.fun/token/${token.address}`,
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Market Cap',
        value: `${marketCap.toFixed(2)} PUSH`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Symbol',
        value: token.symbol,
      },
      {
        '@type': 'PropertyValue',
        name: 'Status',
        value: token.status,
      },
      {
        '@type': 'PropertyValue',
        name: 'Holders',
        value: token.holders.toString(),
      },
    ],
  };

  return <JsonLd data={schema} />;
}

/**
 * Breadcrumb schema for navigation
 */
interface BreadcrumbSchemaProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLd data={schema} />;
}

/**
 * FAQ schema for the launch page
 */
export function LaunchFAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does the bonding curve work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Your token starts with a bonding curve for price discovery. Price increases as more tokens are bought using a constant product formula (x * y = k). This ensures fair and transparent pricing.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens when a token graduates?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'When market cap reaches the graduation threshold (1M PUSH), the token automatically lists on a decentralized exchange (DEX) for continued trading with improved liquidity.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are the fees for launching a token?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'There is a small deploy fee to create a token. Trading incurs a 1% fee, of which 30% goes to the token creator as ongoing revenue.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a pre-sale or team allocation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Hodl.fun uses a fair launch model with no pre-sale and no team allocation. Everyone buys on the same bonding curve.',
        },
      },
    ],
  };

  return <JsonLd data={schema} />;
}
