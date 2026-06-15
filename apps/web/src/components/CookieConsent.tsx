'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { ACCEPT_ALL, REJECT_ALL, useConsent, type ConsentCategories } from '@/lib/consent';
import { Portal } from './Portal';

import styles from './CookieConsent.module.css';

const OPEN_SETTINGS_EVENT = 'spotter:open-cookie-settings';

/**
 * Cookie consent banner + settings dialog.
 *
 * - On first visit (no stored choice): renders a bottom-sheet banner with
 *   "Accept all" / "Reject all" / "Customize" actions.
 * - On demand (via the `spotter:open-cookie-settings` window event, dispatched
 *   by the footer "Cookie settings" link): renders a centered settings dialog
 *   with per-category toggles.
 *
 * The component renders nothing on the server or before consent state is
 * hydrated from localStorage — same SSR-safety pattern as `ThemeProvider`.
 */
export function CookieConsent() {
  const { ready, hasStoredChoice, choices, setChoices } = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customizeExpanded, setCustomizeExpanded] = useState(false);
  // Working copy of the choices for the open settings/expanded banner. Only
  // committed back to the context (and persisted) when the user explicitly
  // saves.
  const [working, setWorking] = useState<ConsentCategories>(ACCEPT_ALL);

  // Open the settings dialog with the current stored choices as the starting
  // point. Called from the event listener below and from the "Customize"
  // button on the banner.
  const openSettings = useCallback((initial: ConsentCategories) => {
    setWorking(initial);
    setCustomizeExpanded(true);
    setSettingsOpen(true);
  }, []);

  // Listen for the footer trigger event
  useEffect(() => {
    function onOpenSettings() {
      // Use the latest stored choices (or DEFAULTS if none yet) as the
      // starting point for the toggles.
      openSettings(choices);
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, [openSettings, choices]);

  // Lock body scroll while ANY consent UI is open (banner or dialog).
  // We consider the banner "open" when the user hasn't stored a choice yet
  // and hasn't explicitly closed it.
  const isOpen = (ready && !hasStoredChoice) || settingsOpen;
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, settingsOpen]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAcceptAll = useCallback(() => {
    setChoices(ACCEPT_ALL);
    setCustomizeExpanded(false);
  }, [setChoices]);

  const handleRejectAll = useCallback(() => {
    setChoices(REJECT_ALL);
    setCustomizeExpanded(false);
  }, [setChoices]);

  const handleSaveWorking = useCallback(() => {
    setChoices(working);
    setCustomizeExpanded(false);
    setSettingsOpen(false);
  }, [setChoices, working]);

  const handleCustomizeInBanner = useCallback(() => {
    // Expand the banner with the current "deny all" defaults as the starting
    // point (the user hasn't made any choice yet).
    setWorking(REJECT_ALL);
    setCustomizeExpanded(true);
  }, []);

  const updateWorking = useCallback((patch: Partial<Omit<ConsentCategories, 'necessary'>>) => {
    setWorking((prev) => ({ ...prev, ...patch }));
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!ready) return null;

  // Settings dialog (opened from footer): centered modal with toggles
  if (settingsOpen) {
    return (
      <Portal>
        <div
          className={styles.overlay}
          data-variant="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
          >
            <h2 id="cookie-settings-title" className={styles.title}>
              Cookie preferences
            </h2>
            <p className={styles.subtitle}>
              Choose which cookies you allow. You can change this any time.{' '}
              <Link href="/privacy#cookies">Privacy policy</Link>
            </p>

            <CategoryList working={working} onChange={updateWorking} />

            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveWorking}>
                Save preferences
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // First-visit banner
  if (!hasStoredChoice) {
    return (
      <Portal>
        <div className={styles.overlay} data-variant="banner">
          <div
            className={styles.banner}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-banner-title"
          >
            <h2 id="cookie-banner-title" className={styles.title}>
              We respect your privacy
            </h2>
            <p className={styles.subtitle}>
              SpotterSpace uses cookies for authentication, and — only with your permission — for
              analytics and advertising. You can choose which categories to allow.{' '}
              <Link href="/privacy#cookies">Learn more</Link>
            </p>

            {customizeExpanded && <CategoryList working={working} onChange={updateWorking} />}

            <div className={styles.actions}>
              {customizeExpanded ? (
                <button type="button" className="btn btn-primary" onClick={handleSaveWorking}>
                  Save preferences
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={handleRejectAll}>
                    Reject all
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleAcceptAll}>
                    Accept all
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCustomizeInBanner}
                  >
                    Customize
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return null;
}

// ─── Sub-component: category toggle list ─────────────────────────────────────

interface CategoryListProps {
  working: ConsentCategories;
  onChange: (patch: Partial<Omit<ConsentCategories, 'necessary'>>) => void;
}

function CategoryList({ working, onChange }: CategoryListProps) {
  return (
    <div className={styles.categories}>
      <Category
        name="Strictly necessary"
        description="Required for the service to function: session and authentication."
        status="Always on"
        checked
        disabled
        onChange={() => {}}
      />
      <Category
        name="Analytics"
        description="Helps us understand how the site is used so we can improve it."
        status={working.analytics ? 'Allowed' : 'Blocked'}
        checked={working.analytics}
        onChange={(v) => onChange({ analytics: v })}
      />
      <Category
        name="Advertising"
        description="Used by Google AdSense to show and measure ads relevant to you."
        status={working.advertising ? 'Allowed' : 'Blocked'}
        checked={working.advertising}
        onChange={(v) => onChange({ advertising: v })}
      />
    </div>
  );
}

interface CategoryProps {
  name: string;
  description: string;
  status: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function Category({ name, description, status, checked, disabled, onChange }: CategoryProps) {
  return (
    <div className={styles.category}>
      <div className={styles.categoryText}>
        <p className={styles.categoryName}>{name}</p>
        <p className={styles.categoryDesc}>{description}</p>
        <span className={styles.categoryStatus}>{status}</span>
      </div>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={name}
        />
        <span className={styles.toggleSwitch} />
      </label>
    </div>
  );
}
