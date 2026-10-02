'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackPageview } from '@/lib/analytics';

export function AnalyticsPageview() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);

  return null;
}
