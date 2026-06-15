import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CookieConsent } from '../components/CookieConsent';
import { ACCEPT_ALL, DEFAULTS, STORAGE_KEY, ConsentProvider, readConsent } from '../lib/consent';

const OPEN_SETTINGS_EVENT = 'spotter:open-cookie-settings';

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderConsent() {
  return render(
    <ConsentProvider>
      <CookieConsent />
    </ConsentProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CookieConsent banner', () => {
  beforeEach(() => {
    localStorage.clear();
    // Stub gtag so applyGtagConsent in ConsentProvider's hydration effect
    // doesn't throw. AdSenseLoader is in a separate file and not under test
    // here.
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    vi.restoreAllMocks();
  });

  it('renders nothing on first paint (pre-useEffect)', () => {
    const { container } = renderConsent();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the bottom-sheet banner when localStorage is empty', async () => {
    renderConsent();
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /we respect your privacy/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/accept all/i)).toBeInTheDocument();
    expect(screen.getByText(/reject all/i)).toBeInTheDocument();
    expect(screen.getByText(/customize/i)).toBeInTheDocument();
  });

  it('does NOT show the banner when a stored consent record exists', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        choices: { necessary: true, analytics: true, advertising: true },
        ts: Date.now(),
      }),
    );
    const { container } = renderConsent();
    // Wait for hydration
    await waitFor(() => {
      // The component renders null when ready and hasStoredChoice — confirm
      // by checking that no dialog appears after a few ticks.
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('"Accept all" stores ACCEPT_ALL and hides the banner', async () => {
    const { container } = renderConsent();
    await waitFor(() => {
      expect(screen.getByText(/accept all/i)).toBeInTheDocument();
    });

    act(() => {
      screen.getByText(/accept all/i).click();
    });

    expect(readConsent()).toEqual(ACCEPT_ALL);
    await waitFor(() => {
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('"Reject all" stores REJECT_ALL (= DEFAULTS for non-essential)', async () => {
    const { container } = renderConsent();
    await waitFor(() => {
      expect(screen.getByText(/reject all/i)).toBeInTheDocument();
    });

    act(() => {
      screen.getByText(/reject all/i).click();
    });

    expect(readConsent()).toEqual(DEFAULTS);
    await waitFor(() => {
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('"Customize" expands the toggles and replaces the buttons with Save', async () => {
    renderConsent();
    await waitFor(() => {
      expect(screen.getByText(/customize/i)).toBeInTheDocument();
    });

    act(() => {
      screen.getByText(/customize/i).click();
    });

    // Toggles appear (one per category)
    expect(screen.getByText(/strictly necessary/i)).toBeInTheDocument();
    expect(screen.getByText(/^analytics$/i)).toBeInTheDocument();
    expect(screen.getByText(/^advertising$/i)).toBeInTheDocument();
    // Save button replaces the three buttons
    expect(screen.getByText(/save preferences/i)).toBeInTheDocument();
  });

  it('the "Strictly necessary" toggle is disabled', async () => {
    renderConsent();
    await waitFor(() => {
      expect(screen.getByText(/customize/i)).toBeInTheDocument();
    });
    act(() => {
      screen.getByText(/customize/i).click();
    });

    const necessaryLabel = screen.getByLabelText(/strictly necessary/i);
    expect(necessaryLabel).toBeDisabled();
  });

  it('saving from the expanded banner persists the toggled values', async () => {
    renderConsent();
    await waitFor(() => screen.getByText(/customize/i));
    act(() => {
      screen.getByText(/customize/i).click();
    });

    // Toggle analytics on (advertising stays off — we don't click it)
    const analyticsToggle = screen.getByLabelText(/^analytics$/i) as HTMLInputElement;
    expect(analyticsToggle.checked).toBe(false);
    act(() => {
      fireEvent.click(analyticsToggle);
    });
    expect(analyticsToggle.checked).toBe(true);

    // Save
    act(() => {
      screen.getByText(/save preferences/i).click();
    });

    expect(readConsent()).toEqual({ necessary: true, analytics: true, advertising: false });
  });
});

// ─── Settings dialog (re-opened via event) ───────────────────────────────────

describe('CookieConsent settings dialog', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    vi.restoreAllMocks();
  });

  function seedWithConsent(choices = { necessary: true, analytics: false, advertising: false }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, choices, ts: Date.now() }));
  }

  it('opens when the open-cookie-settings event is dispatched', async () => {
    seedWithConsent();
    renderConsent();
    // Wait for hydration — banner should NOT appear (consent already stored)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /cookie preferences/i })).toBeInTheDocument();
    });
  });

  it('shows the current stored choices as the starting toggles', async () => {
    seedWithConsent({ necessary: true, analytics: true, advertising: false });
    renderConsent();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /cookie preferences/i })).toBeInTheDocument();
    });

    const analyticsToggle = screen.getByLabelText(/^analytics$/i) as HTMLInputElement;
    const advertisingToggle = screen.getByLabelText(/^advertising$/i) as HTMLInputElement;
    expect(analyticsToggle.checked).toBe(true);
    expect(advertisingToggle.checked).toBe(false);
  });

  it('Escape key closes the settings dialog', async () => {
    seedWithConsent();
    const { container } = renderConsent();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });
    await waitFor(() => screen.getByRole('dialog', { name: /cookie preferences/i }));

    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('backdrop click closes the settings dialog', async () => {
    seedWithConsent();
    renderConsent();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });
    await waitFor(() => screen.getByRole('dialog', { name: /cookie preferences/i }));

    // Portal renders into document.body, not the render container.
    const overlay = document.body.querySelector('[data-variant="modal"]') as HTMLElement;
    expect(overlay).toBeTruthy();
    act(() => {
      fireEvent.click(overlay);
    });

    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('"Save preferences" persists the current toggle values', async () => {
    seedWithConsent({ necessary: true, analytics: false, advertising: false });
    renderConsent();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });
    await waitFor(() => screen.getByRole('dialog', { name: /cookie preferences/i }));

    // Toggle advertising on
    const advertisingToggle = screen.getByLabelText(/^advertising$/i) as HTMLInputElement;
    act(() => {
      fireEvent.click(advertisingToggle);
    });

    act(() => {
      screen.getByText(/save preferences/i).click();
    });

    expect(readConsent()).toEqual({ necessary: true, analytics: false, advertising: true });
  });
});
