import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import {
  ACCEPT_ALL,
  CONSENT_VERSION,
  DEFAULTS,
  REJECT_ALL,
  STORAGE_KEY,
  ConsentProvider,
  applyGtagConsent,
  parseStoredConsent,
  readConsent,
  toGtagConsent,
  useConsent,
  writeConsent,
} from '../lib/consent';

// ─── parseStoredConsent ──────────────────────────────────────────────────────

describe('parseStoredConsent', () => {
  it('returns DEFAULTS for null input', () => {
    expect(parseStoredConsent(null)).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS for empty string', () => {
    expect(parseStoredConsent('')).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS for malformed JSON', () => {
    expect(parseStoredConsent('not json')).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS for a wrong version', () => {
    const stored = JSON.stringify({
      v: 999,
      choices: { necessary: true, analytics: true, advertising: true },
    });
    expect(parseStoredConsent(stored)).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when `necessary` is not true', () => {
    const stored = JSON.stringify({
      v: CONSENT_VERSION,
      choices: { necessary: false, analytics: true, advertising: true },
    });
    expect(parseStoredConsent(stored)).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when `choices` is missing', () => {
    const stored = JSON.stringify({ v: CONSENT_VERSION });
    expect(parseStoredConsent(stored)).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when `choices` is not an object', () => {
    const stored = JSON.stringify({ v: CONSENT_VERSION, choices: 'nope' });
    expect(parseStoredConsent(stored)).toEqual(DEFAULTS);
  });

  it('parses a valid record and coerces non-boolean fields to false', () => {
    const stored = JSON.stringify({
      v: CONSENT_VERSION,
      choices: { necessary: true, analytics: 'yes', advertising: 1 },
    });
    const result = parseStoredConsent(stored);
    expect(result).toEqual({ necessary: true, analytics: false, advertising: false });
  });

  it('parses a fully-granted record', () => {
    const stored = JSON.stringify({
      v: CONSENT_VERSION,
      choices: { necessary: true, analytics: true, advertising: true },
      ts: 1,
    });
    expect(parseStoredConsent(stored)).toEqual(ACCEPT_ALL);
  });
});

// ─── readConsent / writeConsent ──────────────────────────────────────────────

describe('readConsent / writeConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns DEFAULTS when storage is empty', () => {
    expect(readConsent()).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when storage is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(readConsent()).toEqual(DEFAULTS);
  });

  it('round-trips a record', () => {
    writeConsent(ACCEPT_ALL);
    expect(readConsent()).toEqual(ACCEPT_ALL);
  });

  it('round-trips REJECT_ALL', () => {
    writeConsent(REJECT_ALL);
    expect(readConsent()).toEqual(REJECT_ALL);
  });

  it('always persists necessary: true (defense in depth)', () => {
    writeConsent({ necessary: true, analytics: false, advertising: true });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.choices.necessary).toBe(true);
  });

  it('persists a version field', () => {
    writeConsent(ACCEPT_ALL);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.v).toBe(CONSENT_VERSION);
  });

  it('persists a numeric timestamp', () => {
    const before = Date.now();
    writeConsent(ACCEPT_ALL);
    const after = Date.now();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(typeof stored.ts).toBe('number');
    expect(stored.ts).toBeGreaterThanOrEqual(before);
    expect(stored.ts).toBeLessThanOrEqual(after);
  });
});

// ─── toGtagConsent ───────────────────────────────────────────────────────────

describe('toGtagConsent', () => {
  it('maps accept-all to granted signals and ads_data_redaction false', () => {
    expect(toGtagConsent(ACCEPT_ALL)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      ads_data_redaction: false,
    });
  });

  it('maps reject-all to denied signals and ads_data_redaction true', () => {
    expect(toGtagConsent(REJECT_ALL)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      ads_data_redaction: true,
    });
  });

  it('treats analytics-only as partial: analytics granted, advertising denied', () => {
    const partial = { necessary: true as const, analytics: true, advertising: false };
    expect(toGtagConsent(partial)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      ads_data_redaction: true,
    });
  });
});

// ─── applyGtagConsent ────────────────────────────────────────────────────────

describe('applyGtagConsent', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    (window as unknown as { gtag: typeof gtagSpy }).gtag = gtagSpy;
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  });

  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it('calls gtag("consent", "update", ...) with the right shape', () => {
    applyGtagConsent(ACCEPT_ALL);
    expect(gtagSpy).toHaveBeenCalledWith('consent', 'update', toGtagConsent(ACCEPT_ALL));
  });

  it('calls gtag("set", "ads_data_redaction", ...) as a follow-up', () => {
    applyGtagConsent(REJECT_ALL);
    expect(gtagSpy).toHaveBeenCalledWith('set', 'ads_data_redaction', true);
  });

  it('is a no-op when window.gtag is missing', () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    expect(() => applyGtagConsent(ACCEPT_ALL)).not.toThrow();
  });
});

// ─── ConsentProvider ─────────────────────────────────────────────────────────

describe('ConsentProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function Probe() {
    const ctx = useConsent();
    return (
      <div>
        <span data-testid="ready">{String(ctx.ready)}</span>
        <span data-testid="analytics">{String(ctx.choices.analytics)}</span>
        <span data-testid="advertising">{String(ctx.choices.advertising)}</span>
        <span data-testid="has-stored">{String(ctx.hasStoredChoice)}</span>
        <button onClick={() => ctx.setChoices(ACCEPT_ALL)}>accept</button>
        <button onClick={() => ctx.setChoices(REJECT_ALL)}>reject</button>
      </div>
    );
  }

  it('hydrates to ready=true with DEFAULTS when storage is empty', async () => {
    render(
      <ConsentProvider>
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });
    expect(screen.getByTestId('analytics').textContent).toBe('false');
    expect(screen.getByTestId('advertising').textContent).toBe('false');
    expect(screen.getByTestId('has-stored').textContent).toBe('false');
  });

  it('hydrates to hasStoredChoice=true and reflects stored choices', async () => {
    writeConsent(ACCEPT_ALL);
    render(
      <ConsentProvider>
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });
    expect(screen.getByTestId('analytics').textContent).toBe('true');
    expect(screen.getByTestId('advertising').textContent).toBe('true');
    expect(screen.getByTestId('has-stored').textContent).toBe('true');
  });

  it('setChoices persists to localStorage and updates state', async () => {
    render(
      <ConsentProvider>
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      screen.getByText('accept').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('analytics').textContent).toBe('true');
    });
    expect(readConsent()).toEqual(ACCEPT_ALL);
    expect(screen.getByTestId('has-stored').textContent).toBe('true');
  });
});
