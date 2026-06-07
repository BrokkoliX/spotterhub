import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SocialShareIcons } from '../components/SocialShareIcons';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Replace `navigator.clipboard` for the duration of a test. Returns a
 * cleanup that restores the original property descriptor.
 */
function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined): () => void {
  const prev = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: writeText ? { writeText } : undefined,
  });
  return () => {
    if (prev) Object.defineProperty(navigator, 'clipboard', prev);
    else delete (navigator as unknown as Record<string, unknown>).clipboard;
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SocialShareIcons', () => {
  // jsdom defaults to "http://localhost:3000" for window.location.origin —
  // the component falls back to that when NEXT_PUBLIC_WEB_URL is unset.
  const expectedUrl = 'http://localhost:3000/photos/photo-123';

  let restoreClipboard: () => void = () => {};

  function spyOnWindowOpen() {
    return vi.spyOn(window, 'open').mockImplementation(() => null);
  }

  beforeEach(() => {
    spyOnWindowOpen();
  });

  afterEach(() => {
    restoreClipboard();
    restoreClipboard = () => {};
    vi.restoreAllMocks();
  });

  it('renders three inline share icons', () => {
    render(<SocialShareIcons photoId="photo-123" />);

    expect(screen.getByRole('button', { name: /share on facebook/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /share on x/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /share on instagram/i })).toBeTruthy();
  });

  it('opens facebook.com/sharer with the encoded photo URL', () => {
    const openSpy = spyOnWindowOpen();

    render(<SocialShareIcons photoId="photo-123" />);
    fireEvent.click(screen.getByRole('button', { name: /share on facebook/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(expectedUrl)}`,
    );
    expect(target).toBe('_blank');
    expect(features).toMatch(/noopener/);
    expect(features).toMatch(/noreferrer/);
  });

  it('opens twitter.com/intent/tweet with url + share text', () => {
    const openSpy = spyOnWindowOpen();

    render(
      <SocialShareIcons
        photoId="photo-123"
        photoCaption="Spectacular departure"
        photographerName="Jane"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /share on x/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0];
    const expectedText = encodeURIComponent('Spectacular departure — by Jane on SpotterSpace');
    expect(url).toBe(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(expectedUrl)}&text=${expectedText}`,
    );
  });

  it('Instagram button copies the link and shows a "paste in Instagram" toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    restoreClipboard = stubClipboard(writeText);

    render(<SocialShareIcons photoId="photo-123" />);
    fireEvent.click(screen.getByRole('button', { name: /share on instagram/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/paste it in your instagram/i);
    });
  });

  it('Instagram button falls back to a manual-copy message when clipboard is unavailable', async () => {
    restoreClipboard = stubClipboard(undefined);

    render(<SocialShareIcons photoId="photo-123" />);
    fireEvent.click(screen.getByRole('button', { name: /share on instagram/i }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Copy this link');
      expect(status.textContent).toContain(expectedUrl);
    });
  });
});
