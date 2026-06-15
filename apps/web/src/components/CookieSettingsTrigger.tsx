'use client';

import { useCallback } from 'react';

import styles from './CookieSettingsTrigger.module.css';

/**
 * Button-styled link that opens the cookie consent settings dialog.
 *
 * Dispatches a `spotter:open-cookie-settings` window event listened for by
 * `<CookieConsent />`. Lives in the footer (which is a Server Component) — so
 * this small client component is the bridge.
 */
export function CookieSettingsTrigger() {
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('spotter:open-cookie-settings'));
  }, []);

  return (
    <button type="button" className={styles.trigger} onClick={handleClick}>
      Cookie settings
    </button>
  );
}
