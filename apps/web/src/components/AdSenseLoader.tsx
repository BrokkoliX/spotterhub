'use client';

import { useEffect } from 'react';
import { useQuery } from 'urql';

import { useConsent } from '@/lib/consent';
import { GET_AD_SETTINGS } from '@/lib/queries';

const PLACEHOLDER_CLIENT_ID = 'ca-pub-XXXXXXXXXXXXXXXX';

// Module-level guard so the script is only injected once per page load.
// Kept in this client component (not in a separate lib) so HMR doesn't trip
// over the flag — Next.js dev hot-reloads can re-evaluate the module and
// reset a flag, but the `data-adsense-loader` DOM check below catches the
// case where the script element is already present.
let injected = false;

/**
 * Injects the AdSense publisher script. Idempotent: safe to call repeatedly.
 * Returns `true` if the script was newly appended, `false` if it was already
 * injected, the clientId was empty, or the placeholder was passed.
 */
function injectAdSenseScript(clientId: string): boolean {
  if (injected) return false;
  if (!clientId) return false;
  if (document.querySelector('script[data-adsense-loader="true"]')) {
    injected = true;
    return false;
  }
  injected = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  script.crossOrigin = 'anonymous';
  script.dataset.adsenseLoader = 'true';
  // Notify AdBanner once the script has actually executed (so
  // `window.adsbygoogle` is defined) so its `adsbygoogle.push` will land.
  // We also notify on error so AdBanner can stop waiting and avoid a
  // permanent "no ads" state if the network is blocked.
  const notifyInjected = () => {
    window.dispatchEvent(new CustomEvent('spotter:ad-sense-injected', { detail: { clientId } }));
  };
  script.onload = notifyInjected;
  script.onerror = notifyInjected;
  document.head.appendChild(script);
  return true;
}

interface AdSettingsData {
  adSettings: {
    enabled: boolean;
    adSenseClientId: string;
  } | null;
}

/**
 * Watches consent and injects the AdSense publisher script the moment
 * advertising consent is granted. Renders nothing — this is a side-effect
 * manager. Mount once near the root of the tree.
 *
 * The matching `AdBanner` component listens for the `spotter:ad-sense-injected`
 * window event to re-time its `adsbygoogle.push` after injection.
 */
export function AdSenseLoader() {
  const { choices, ready } = useConsent();
  const consentGranted = ready && choices.advertising;

  // Only fetch the ad settings when the user has actually opted in. This
  // avoids a network request on every page load for users who have rejected
  // advertising — they would never see the script anyway.
  const [{ data }] = useQuery<AdSettingsData>({
    query: GET_AD_SETTINGS,
    pause: !consentGranted,
  });

  const settings = data?.adSettings;
  const dbClientId =
    settings?.adSenseClientId && settings.adSenseClientId !== PLACEHOLDER_CLIENT_ID
      ? settings.adSenseClientId
      : '';
  const envClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';
  const clientId = dbClientId || envClientId;
  const shouldInject = consentGranted && settings?.enabled === true && clientId !== '';

  useEffect(() => {
    if (shouldInject) {
      injectAdSenseScript(clientId);
    }
  }, [shouldInject, clientId]);

  return null;
}
