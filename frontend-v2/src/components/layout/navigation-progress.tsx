'use client';

import { useEffect, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  speed: 300,
  trickleSpeed: 200,
});

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Complete progress when route changes
    NProgress.done();
    previousPathname.current = pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    // Handle link clicks to start progress
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only handle internal links
      if (href.startsWith('/') && !href.startsWith('//')) {
        // Don't start for same-page anchors or current page
        const currentPath = window.location.pathname;
        const newPath = href.split('?')[0].split('#')[0];

        if (newPath !== currentPath) {
          NProgress.start();
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

// Export hooks for manual control if needed
export function useNavigationProgress() {
  return {
    start: () => NProgress.start(),
    done: () => NProgress.done(),
    set: (n: number) => NProgress.set(n),
  };
}
