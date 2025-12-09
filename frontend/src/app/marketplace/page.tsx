'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MarketplacePage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page (which is now the marketplace)
    router.replace('/');
  }, [router]);

  return null;
};

export default MarketplacePage;
