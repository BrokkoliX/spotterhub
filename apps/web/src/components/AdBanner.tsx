'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';

import { useConsent } from '@/lib/consent';
import { GET_AD_SETTINGS } from '@/lib/queries';

import styles from './AdBanner.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

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

const PLACEHOLDER_CLIENT_ID = 'ca-pub-XXXXXXXXXXXXXXXX';

// ─── AdBanner ─────────────────────────────────────────────────────────────────

/**
 * Renders a single AdSense ad slot. The AdSense publisher script itself is
 * injected once per page by `<AdSenseLoader />` (mounted in the root layout)
 * — this component only handles the per-slot `<ins>` markup and the
 * `adsbygoogle.push` that registers the slot with AdSense.
 *
 * Hard-gated on advertising consent: if the user has not opted in, returns
 * `null` and does not register with AdSense.
 */
export function AdBanner({ slotId, format = 'autorelaxed', className, style }: AdBannerProps) {
  const insRef = useRef<HTMLModElement>(null);
  const { choices, ready } = useConsent();
  // `scriptInjected` flips when `<AdSenseLoader />` dispatches its event.
  // Used as a useEffect dep so the push re-runs once `window.adsbygoogle`
  // becomes defined.
  const [scriptInjected, setScriptInjected] = useState(false);
  const [{ data }] = useQuery<AdSettingsData>({ query: GET_AD_SETTINGS });

  const settings = data?.adSettings;
  const isConfigured =
    ready &&
    choices.advertising === true &&
    settings?.enabled === true &&
    slotId &&
    settings.adSenseClientId &&
    settings.adSenseClientId !== PLACEHOLDER_CLIENT_ID;

  // Listen for the script-loaded event from AdSenseLoader, and also catch
  // up synchronously in case the script was injected before this component
  // mounted (e.g. on a page that's rehydrated from cache).
  useEffect(() => {
    function onInjected() {
      setScriptInjected(true);
    }
    window.addEventListener('spotter:ad-sense-injected', onInjected);
    if (document.querySelector('script[data-adsense-loader="true"]')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from DOM (script tag presence) requires setState in an effect
      setScriptInjected(true);
    }
    return () => window.removeEventListener('spotter:ad-sense-injected', onInjected);
  }, []);

  // Push the slot to AdSense. We push as soon as we're configured AND
  // `window.adsbygoogle` is defined (which the AdSenseLoader event signals).
  useEffect(() => {
    if (!isConfigured) return;
    if (typeof window === 'undefined') return;
    const w = window as unknown as { adsbygoogle: unknown[] };
    if (!w.adsbygoogle) return;
    (w.adsbygoogle = w.adsbygoogle || []).push({});
  }, [isConfigured, scriptInjected]);

  if (!isConfigured) return null;

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
