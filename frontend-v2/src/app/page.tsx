import { Suspense } from 'react';
import { HomeContent, HomePageSkeleton } from '@/components/home/home-content';

// Server Component - no 'use client' directive
// This allows Next.js to optimize initial rendering and streaming
export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
