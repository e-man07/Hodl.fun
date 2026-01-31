import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.thehodl.fun';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/launch`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    // Note: /dashboard is excluded from sitemap because it has robots noindex
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic token pages - fetch from API if available
  let tokenPages: MetadataRoute.Sitemap = [];

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${apiUrl}/tokens?limit=1000`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (response.ok) {
      const data = await response.json();
      const tokens = data.data || [];

      tokenPages = tokens.map((token: { address: string; updatedAt?: string }) => ({
        url: `${BASE_URL}/token/${token.address}`,
        lastModified: token.updatedAt ? new Date(token.updatedAt) : new Date(),
        changeFrequency: 'hourly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // API not available during build, return static pages only
    console.warn('Could not fetch tokens for sitemap');
  }

  return [...staticPages, ...tokenPages];
}
