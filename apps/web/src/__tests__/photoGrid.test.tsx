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
    aircraftType: 'Boeing 747-8',
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
        variantType: 'display',
        url: 'https://example.com/display.jpg',
        width: 800,
        height: 600,
      },
    ],
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
        <PhotoGrid photos={photos} hasNextPage={false} loading={false} onLoadMore={() => {}} />
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
          hasNextPage={false}
          loading={false}
          onLoadMore={() => {}}
          emptyMessage="No photos match your filters."
        />
      </AuthProvider>,
    );

    expect(screen.getByText('No photos match your filters.')).toBeTruthy();
    expect(screen.getByText('Be the first to share an aviation photo!')).toBeTruthy();
  });

  it('shows load more button when hasNextPage is true', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} hasNextPage={true} loading={false} onLoadMore={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('does not show load more button when hasNextPage is false', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} hasNextPage={false} loading={false} onLoadMore={() => {}} />
      </AuthProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows loading text in load more button when loading', () => {
    const photos = [createMockPhoto({ id: 'p1' })];

    render(
      <AuthProvider>
        <PhotoGrid photos={photos} hasNextPage={true} loading={true} onLoadMore={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeTruthy();
  });

  it('renders default empty message when none provided', () => {
    render(
      <AuthProvider>
        <PhotoGrid photos={[]} hasNextPage={false} loading={false} onLoadMore={() => {}} />
      </AuthProvider>,
    );

    expect(screen.getByText('No photos yet')).toBeTruthy();
  });
});
