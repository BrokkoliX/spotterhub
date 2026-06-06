import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ShareButton } from '../components/ShareButton';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Replace `navigator.share` (and optionally `navigator.clipboard`) for the
 * duration of a test, returning a cleanup that restores the originals.
 *
 * `navigator` is a host object, so we can't simply assign new properties —
 * we re-define them with `Object.defineProperty` and put the previous
 * descriptor back when the test ends.
 */
function stubNavigator(overrides: {
  share?: ((data: ShareData) => Promise<void>) | undefined;
  clipboardWriteText?: ((text: string) => Promise<void>) | undefined;
}): () => void {
  const originals: Array<() => void> = [];

  if ('share' in overrides) {
    const prev = Object.getOwnPropertyDescriptor(navigator, 'share');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: overrides.share,
    });
    originals.push(() => {
      if (prev) Object.defineProperty(navigator, 'share', prev);
      else delete (navigator as unknown as Record<string, unknown>).share;
    });
  }

  if ('clipboardWriteText' in overrides) {
    const prev = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: overrides.clipboardWriteText ? { writeText: overrides.clipboardWriteText } : undefined,
    });
    originals.push(() => {
      if (prev) Object.defineProperty(navigator, 'clipboard', prev);
      else delete (navigator as unknown as Record<string, unknown>).clipboard;
    });
  }

  return () => originals.forEach((fn) => fn());
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ShareButton', () => {
  // jsdom defaults to "http://localhost:3000" for window.location.origin —
  // the component falls back to that when NEXT_PUBLIC_WEB_URL is unset.
  const expectedUrl = 'http://localhost:3000/photos/photo-123';

  let restoreNavigator: () => void = () => {};

  function spyOnWindowOpen() {
    return vi.spyOn(window, 'open').mockImplementation(() => null);
  }

  beforeEach(() => {
    // Default: no-op spy so we can safely call window.open across all tests.
    spyOnWindowOpen();
  });

  afterEach(() => {
    restoreNavigator();
    restoreNavigator = () => {};
    vi.restoreAllMocks();
  });

  it('uses navigator.share when available and does not open the popover', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    restoreNavigator = stubNavigator({ share: shareMock });

    render(
      <ShareButton
        photoId="photo-123"
        photoCaption="Cool 747"
        photographerName="Av Spotter"
        aircraftLabel="N747BA"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Cool 747',
      text: 'Cool 747 — by Av Spotter on SpotterSpace',
      url: expectedUrl,
    });
    // Popover should NOT have appeared on the share-API path.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('treats AbortError from navigator.share as a no-op (no popover fallback)', async () => {
    const shareMock = vi.fn().mockRejectedValue(
      // jsdom provides DOMException
      new DOMException('User cancelled', 'AbortError'),
    );
    restoreNavigator = stubNavigator({ share: shareMock });

    render(<ShareButton photoId="photo-123" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    // No popover should appear when the user dismisses the native sheet.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the popover when navigator.share is unavailable', async () => {
    restoreNavigator = stubNavigator({ share: undefined });

    render(<ShareButton photoId="photo-123" photoCaption="Caption" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /share options/i })).toBeTruthy();
    });
    expect(screen.getByRole('menuitem', { name: /facebook/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /x \(twitter\)/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeTruthy();
  });

  it('opens facebook.com/sharer with the encoded photo URL', async () => {
    restoreNavigator = stubNavigator({ share: undefined });
    const openSpy = spyOnWindowOpen();

    render(<ShareButton photoId="photo-123" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));
    await waitFor(() => screen.getByRole('menu'));

    fireEvent.click(screen.getByRole('menuitem', { name: /facebook/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(expectedUrl)}`,
    );
    expect(target).toBe('_blank');
    expect(features).toMatch(/noopener/);
    expect(features).toMatch(/noreferrer/);
  });

  it('opens twitter.com/intent/tweet with url + share text', async () => {
    restoreNavigator = stubNavigator({ share: undefined });
    const openSpy = spyOnWindowOpen();

    render(
      <ShareButton
        photoId="photo-123"
        photoCaption="Spectacular departure"
        photographerName="Jane"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));
    await waitFor(() => screen.getByRole('menu'));

    fireEvent.click(screen.getByRole('menuitem', { name: /x \(twitter\)/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0];
    const expectedText = encodeURIComponent('Spectacular departure — by Jane on SpotterSpace');
    expect(url).toBe(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(expectedUrl)}&text=${expectedText}`,
    );
  });

  it('writes the URL to the clipboard and shows "Copied!" feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    restoreNavigator = stubNavigator({ share: undefined, clipboardWriteText: writeText });

    render(<ShareButton photoId="photo-123" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));
    await waitFor(() => screen.getByRole('menu'));

    fireEvent.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /copied/i })).toBeTruthy();
    });
  });

  it('shows "Copy failed" when the clipboard API is unavailable', async () => {
    restoreNavigator = stubNavigator({ share: undefined, clipboardWriteText: undefined });

    render(<ShareButton photoId="photo-123" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));
    await waitFor(() => screen.getByRole('menu'));

    fireEvent.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /copy failed/i })).toBeTruthy();
    });
  });

  it('closes the popover when Escape is pressed', async () => {
    restoreNavigator = stubNavigator({ share: undefined });

    render(<ShareButton photoId="photo-123" />);

    fireEvent.click(screen.getByRole('button', { name: /share photo/i }));
    await waitFor(() => screen.getByRole('menu'));

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
