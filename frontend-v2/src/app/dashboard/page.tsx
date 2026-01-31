import { Suspense } from 'react';
import { DashboardContent, DashboardPageSkeleton } from '@/components/dashboard/dashboard-content';

// Server Component - no 'use client' directive
// This allows Next.js to optimize initial rendering and streaming
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
