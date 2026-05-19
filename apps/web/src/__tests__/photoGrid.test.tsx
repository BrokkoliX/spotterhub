import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuthProvider } from '../lib/auth';
import { PhotoGrid, type PhotoData } from '../components/PhotoGrid';

// ─── Mock FollowButton so it doesn't call urql hooks ─────────────────────────

vi.mock('../components/FollowButton', () => ({
  FollowButton: ({ userId }: { userId: string }) => (
    <button data-testid={`follow-${userId}`}>Follow</button>
  ),
}));

vi.mock('../components/LikeButton', () => ({
  LikeButton: () => <button>Like</button>,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockPhoto(overrides: Partial<PhotoData> = {}): PhotoData {
  return {
    id: 'photo-1',
    caption: 'Boeing 747 at sunset',
    airline: 'Lufthansa',
    airportCode: 'EDDF',
    originalUrl: 'https://example.com/photo.jpg',
    tags: ['boeing', 'sunset'],
    likeCount: 42,
    commentCount: 3,
    isLikedByMe: false,
    createdAt: '2024-01-01T00:00:00Z',
    user: {
      id: 'user-1',
      username: 'avspotter',
      profile: { displayName: 'Av Spotter', avatarUrl: null },
    },
    variants: [
      {
        variantType: 'thumbnail',
        url: 'https://example.com/thumb.jpg',
        width: 200,
        height: 150,
      },
      {
        variantType: 'thumbnail_16x9',
        url: 'https://example.com/thumb-16x9.jpg',
        width: 640,
        height: 360,
      },
      {
        variantType: 'display',
        url: 'https://example.com/display.jpg',
        width: 800,
        height: 600,
      },
    ],
    aircraft: {
      manufacturer: { name: 'Boeing' },
      family: { name: '747-8' },
      variant: { name: '747-8F', iataCode: '748', icaoCode: 'B748' },
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PhotoGrid', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders a grid of PhotoCards', () => {
    const photos = [
      createMockPhoto({ id: 'p1', caption: 'Photo 1' }),
      createMockPhoto({ id: 'p2', caption: 'Photo 2' }),
    ];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} currentPage={1} totalPages={1} onPageChange={() => {}} />
      </AuthProvider>,
    );

    expect(screen.queryByText('Photo 1')).toBeTruthy();
    expect(screen.queryByText('Photo 2')).toBeTruthy();
  });

  it('renders empty state with custom message', () => {
    render(
      <AuthProvider>
        <PhotoGrid
          photos={[]}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          emptyMessage="No photos match your filters."
        />
      </AuthProvider>,
    );

    expect(screen.getByText('No photos match your filters.')).toBeTruthy();
    expect(screen.getByText('Be the first to share an aviation photo!')).toBeTruthy();
  });

  it('renders pagination when totalPages > 1', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} currentPage={1} totalPages={3} onPageChange={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  });

  it('does not render pagination when totalPages is 1', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} currentPage={1} totalPages={1} onPageChange={() => {}} />
      </AuthProvider>,
    );

    expect(screen.queryByText('Page 1 of 1')).toBeNull();
  });

  it('shows loading state via loading prop', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} currentPage={1} totalPages={3} onPageChange={() => {}} loading={true} />
      </AuthProvider>,
    );

    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  });

  it('renders default empty message when none provided', () => {
    render(
      <AuthProvider>
        <PhotoGrid photos={[]} currentPage={1} totalPages={1} onPageChange={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByText('No photos yet')).toBeTruthy();
  });

  // ─── Variant priority tests ─────────────────────────────────────────────────

  it('grid view prefers thumbnail_16x9 over watermarked and other variants', () => {
    const photo = createMockPhoto({
      id: 'p-priority',
      watermarkEnabled: true,
      variants: [
        { variantType: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 200, height: 150 },
        { variantType: 'thumbnail_16x9', url: 'https://example.com/thumb-16x9.jpg', width: 640, height: 360 },
        { variantType: 'display', url: 'https://example.com/display.jpg', width: 800, height: 600 },
        { variantType: 'watermarked', url: 'https://example.com/watermarked.jpg', width: 4000, height: 3000 },
      ],
    });

    render(
      <AuthProvider>
        <PhotoGrid photos={[photo]} currentPage={1} totalPages={1} onPageChange={() => {}} />
      </AuthProvider>,
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/thumb-16x9.jpg');
  });

  it('grid view falls back to display when thumbnail_16x9 is missing', () => {
    const photo = createMockPhoto({
      id: 'p-fallback',
      variants: [
        { variantType: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 200, height: 150 },
        { variantType: 'display', url: 'https://example.com/display.jpg', width: 800, height: 600 },
      ],
    });

    render(
      <AuthProvider>
        <PhotoGrid photos={[photo]} currentPage={1} totalPages={1} onPageChange={() => {}} />
      </AuthProvider>,
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/display.jpg');
  });

  it('list view prefers thumbnail_16x9 for thumbnails', () => {
    const photo = createMockPhoto({
      id: 'p-list',
      variants: [
        { variantType: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 200, height: 150 },
        { variantType: 'thumbnail_16x9', url: 'https://example.com/thumb-16x9.jpg', width: 640, height: 360 },
        { variantType: 'display', url: 'https://example.com/display.jpg', width: 800, height: 600 },
      ],
    });

    render(
      <AuthProvider>
        <PhotoGrid photos={[photo]} currentPage={1} totalPages={1} onPageChange={() => {}} viewMode="list" />
      </AuthProvider>,
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/thumb-16x9.jpg');
  });
});
