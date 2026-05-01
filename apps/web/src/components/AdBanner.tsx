'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from 'urql';

import { GET_AD_SETTINGS } from '@/lib/queries';

import styles from './AdBanner.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdSettingsData {
  adSettings: {
    enabled: boolean;
    adSenseClientId: string;
    slotFeed: string | null;
    slotPhotoDetail: string | null;
    slotSidebar: string | null;
  } | null;
}

interface AdBannerProps {
  slotId: string;
  format?: 'autorelaxed' | 'fluid' | 'rectangle' | 'in-article';
  className?: string;
  style?: React.CSSProperties;
}

// ─── Script injection guard ────────────────────────────────────────────────────

let scriptInjected = false;

function injectAdSenseScript(clientId: string) {
  if (scriptInjected || !clientId || clientId === 'ca-pub-XXXXXXXXXXXXXXXX') return;
  scriptInjected = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

// ─── AdBanner ─────────────────────────────────────────────────────────────────

export function AdBanner({ slotId, format = 'autorelaxed', className, style }: AdBannerProps) {
  const insRef = useRef<HTMLModElement>(null);
  const [{ data }] = useQuery<AdSettingsData>({ query: GET_AD_SETTINGS });

  const settings = data?.adSettings;
  if (!settings?.enabled || !slotId || !settings.adSenseClientId || settings.adSenseClientId === 'ca-pub-XXXXXXXXXXXXXXXX') {
    return null;
  }

  // Inject the AdSense script once (idempotent)
  injectAdSenseScript(settings.adSenseClientId);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle) {
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle = (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle || []).push({});
    }
  }, []);

  return (
    <div className={`${styles.container} ${className ?? ''}`} style={style}>
      <ins
        ref={insRef}
        className={styles.ins}
        data-ad-client={settings.adSenseClientId}
        data-ad-slot={slotId}
        data-ad-format={format === 'fluid' ? 'fluid' : 'auto'}
        data-full-width-responsive="true"
      />
    </div>
  );
}
