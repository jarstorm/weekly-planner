'use client';

import Script from 'next/script';
import { markGoatcounterReady } from '@/lib/analytics';

export function GoatCounterScript({ url }: { url: string }) {
  return (
    <Script
      data-goatcounter={`${url}/count`}
      data-goatcounter-settings='{"no_onload": true}'
      src={`${url}/count.js`}
      strategy="afterInteractive"
      onLoad={markGoatcounterReady}
    />
  );
}
