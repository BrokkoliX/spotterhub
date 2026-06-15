'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConsentChoice = 'granted' | 'denied';

/**
 * Per-category user consent. `necessary` is always `true` — it represents the
 * cookies required for the service to function (session, auth) and is exempt
 * from consent requirements under GDPR/ePrivacy. The literal `true` type
 * prevents callers from ever disabling it.
 */
export interface ConsentCategories {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
}

interface StoredConsent {
  v: number;
  choices: ConsentCategories;
  ts: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Bump when the storage schema changes to force a re-prompt. */
export const CONSENT_VERSION = 1;

/** localStorage key. Versioned in the name for symmetry with the schema version. */
export const STORAGE_KEY = 'spotter_consent_v1';

/** First-visit default: deny everything non-essential. */
export const DEFAULTS: ConsentCategories = {
  necessary: true,
  analytics: false,
  advertising: false,
};

/** Convenient constants for the banner buttons. */
export const ACCEPT_ALL: ConsentCategories = {
  necessary: true,
  analytics: true,
  advertising: true,
};

export const REJECT_ALL: ConsentCategories = DEFAULTS;

// ─── Storage ────────────────────────────────────────────────────────────────

/**
 * Parse a stored consent JSON string. Returns `DEFAULTS` on any kind of
 * failure (missing, malformed JSON, version mismatch, missing required
 * fields). Pure function so the head `<script>` can use the same logic
 * (duplicated inline in `app/layout.tsx` for the pre-React bootstrap).
 */
export function parseStoredConsent(stored: string | null): ConsentCategories {
  if (!stored) return DEFAULTS;
  try {
    const parsed = JSON.parse(stored) as Partial<StoredConsent>;
    if (parsed.v !== CONSENT_VERSION) return DEFAULTS;
    if (!parsed.choices || typeof parsed.choices !== 'object') return DEFAULTS;
    // `necessary` must always be true — refuse to load records that don't.
    if ((parsed.choices as { necessary?: unknown }).necessary !== true) return DEFAULTS;
    return {
      necessary: true,
      analytics: parsed.choices.analytics === true,
      advertising: parsed.choices.advertising === true,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Read the current consent from localStorage. SSR-safe. */
export function readConsent(): ConsentCategories {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return parseStoredConsent(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULTS;
  }
}

/** Persist consent. Silently swallows storage errors. */
export function writeConsent(choices: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  try {
    const record: StoredConsent = { v: CONSENT_VERSION, choices, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be disabled (private mode, quota); consent is best-effort.
  }
}

// ─── Google Consent Mode v2 ─────────────────────────────────────────────────

/**
 * Shape of the gtag `consent` call. See
 * https://developers.google.com/tag-platform/security/guides/consent
 */
export interface GtagConsent {
  analytics_storage: ConsentChoice;
  ad_storage: ConsentChoice;
  ad_user_data: ConsentChoice;
  ad_personalization: ConsentChoice;
  /**
   * When `true`, Google removes identifiers from outgoing hits so that
   * downstream processing cannot re-identify users. Recommended alongside
   * `ad_storage: 'denied'`.
   */
  ads_data_redaction: boolean;
}

export function toGtagConsent(c: ConsentCategories): GtagConsent {
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.advertising ? 'granted' : 'denied',
    ad_user_data: c.advertising ? 'granted' : 'denied',
    ad_personalization: c.advertising ? 'granted' : 'denied',
    ads_data_redaction: !c.advertising,
  };
}

/**
 * Push a consent update onto gtag's dataLayer. Idempotent: calling with the
 * same choices twice is a no-op semantically. No-op on the server or when
 * gtag is not yet defined (the head `<script>` defines the stub before this
 * runs in the browser).
 */
export function applyGtagConsent(c: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== 'function') return;
  const consent = toGtagConsent(c);
  w.gtag('consent', 'update', consent);
  // The follow-up `set` is required for `ads_data_redaction` to take effect.
  w.gtag('set', 'ads_data_redaction', consent.ads_data_redaction);
}

// ─── React context ──────────────────────────────────────────────────────────

export interface ConsentContextValue {
  choices: ConsentCategories;
  /** False during SSR + first client render. True after the localStorage hydration effect has run. */
  ready: boolean;
  /** True iff the user has made an explicit choice. False on first visit. */
  hasStoredChoice: boolean;
  setChoices: (next: ConsentCategories) => void;
}

const ConsentContext = createContext<ConsentContextValue>({
  choices: DEFAULTS,
  ready: false,
  hasStoredChoice: false,
  setChoices: () => {},
});

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext);
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  // Server and initial client render both start with DEFAULTS + not ready.
  // This matches the inline head script's fallback and prevents any VDOM
  // diff from becoming a hydration error on the children tree. The pattern
  // is identical to apps/web/src/lib/theme.tsx (ThemeProvider).
  const [state, setState] = useState<{
    choices: ConsentCategories;
    ready: boolean;
    hasStoredChoice: boolean;
  }>({
    choices: DEFAULTS,
    ready: false,
    hasStoredChoice: false,
  });

  // Hydrate from localStorage after mount (client-only).
  useEffect(() => {
    let choices = DEFAULTS;
    let hasStoredChoice = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        choices = parseStoredConsent(stored);
        hasStoredChoice = true;
      }
    } catch {
      // localStorage unavailable — stay at DEFAULTS
    }
    // The head <script> in layout.tsx already called gtag('consent', 'default', ...)
    // with these choices before React mounted. Push an `update` here so that
    // any subsequent gtag.js loads (e.g. lazy AdBanner script) inherit the
    // same state even if the head script failed for any reason.
    applyGtagConsent(choices);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after SSR requires setState in an effect
    setState({ choices, ready: true, hasStoredChoice });
  }, []);

  const setChoices = useCallback((next: ConsentCategories) => {
    setState({ choices: next, ready: true, hasStoredChoice: true });
    writeConsent(next);
    applyGtagConsent(next);
  }, []);

  const value = useMemo(
    () => ({
      choices: state.choices,
      ready: state.ready,
      hasStoredChoice: state.hasStoredChoice,
      setChoices,
    }),
    [state, setChoices],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
