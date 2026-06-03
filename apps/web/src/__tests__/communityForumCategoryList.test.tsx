import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as urql from 'urql';
import type { DocumentNode } from 'graphql';

import { CommunityForumCategoryList } from '../components/forum/CommunityForumCategoryList';
import { ForumCategoriesDocument } from '../lib/generated/graphql';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

interface UseQueryResponse {
  data?: unknown;
  fetching?: boolean;
}

function setupUrqlQueries(routes: Map<DocumentNode, UseQueryResponse>): void {
  const useQueryMock = vi.mocked(urql.useQuery);
  useQueryMock.mockImplementation(((args: { query: unknown; pause?: boolean }) => {
    const route = routes.get(args.query as DocumentNode);
    if (!route || args.pause) {
      return [{ data: null, fetching: false, stale: false }, vi.fn()];
    }
    return [{ data: route.data ?? null, fetching: route.fetching ?? false, stale: false }, vi.fn()];
  }) as unknown as typeof urql.useQuery);
}

function setupUrqlMutation(executeMutation = vi.fn().mockResolvedValue({ data: null })) {
  const useMutationMock = vi.mocked(urql.useMutation);
  useMutationMock.mockImplementation((() => [
    { data: null, fetching: false, stale: false },
    executeMutation,
  ]) as unknown as typeof urql.useMutation);
  return executeMutation;
}

const SAMPLE_CATEGORY = (overrides: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  name: 'General Discussion',
  slug: 'general',
  description: 'Anything goes',
  threadCount: 4,
  latestThread: {
    id: 'thread-1',
    title: 'Welcome thread',
    lastPostAt: new Date('2026-05-01T12:00:00Z').toISOString(),
    author: { username: 'pilot' },
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  setupUrqlMutation();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CommunityForumCategoryList', () => {
  it('renders each category and links directly to its forum URL — no interstitial click required', () => {
    setupUrqlQueries(
      new Map([
        [
          ForumCategoriesDocument,
          {
            data: {
              forumCategories: [
                SAMPLE_CATEGORY({ id: 'cat-1', name: 'General', slug: 'general' }),
                SAMPLE_CATEGORY({
                  id: 'cat-2',
                  name: 'Gear Talk',
                  slug: 'gear-talk',
                  latestThread: null,
                }),
              ],
            },
          },
        ],
      ]),
    );

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={false}
      />,
    );

    const generalLink = screen.getByRole('link', { name: /General/i });
    expect(generalLink).toHaveAttribute('href', '/communities/lhr-spotters/forum/general');

    const gearLink = screen.getByRole('link', { name: /Gear Talk/i });
    expect(gearLink).toHaveAttribute('href', '/communities/lhr-spotters/forum/gear-talk');
  });

  it('shows the empty state when the community has no forum categories', () => {
    setupUrqlQueries(new Map([[ForumCategoriesDocument, { data: { forumCategories: [] } }]]));

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={false}
      />,
    );

    expect(screen.getByText(/No forum categories yet/i)).toBeInTheDocument();
    // Non-admins must not see the create CTA.
    expect(screen.queryByRole('button', { name: /Create the first category/i })).toBeNull();
  });

  it('hides admin controls (create + delete) for non-admins', () => {
    setupUrqlQueries(
      new Map([[ForumCategoriesDocument, { data: { forumCategories: [SAMPLE_CATEGORY()] } }]]),
    );

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /\+ New Category/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete category/i })).toBeNull();
  });

  it('renders the "+ New Category" button for admins when showCreateButton is true (default)', () => {
    setupUrqlQueries(
      new Map([[ForumCategoriesDocument, { data: { forumCategories: [SAMPLE_CATEGORY()] } }]]),
    );

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={true}
      />,
    );

    expect(screen.getByRole('button', { name: /\+ New Category/i })).toBeInTheDocument();
  });

  it('omits the internal "+ New Category" button when showCreateButton is false (delegated to parent header)', () => {
    setupUrqlQueries(
      new Map([[ForumCategoriesDocument, { data: { forumCategories: [SAMPLE_CATEGORY()] } }]]),
    );

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={true}
        showCreateButton={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /\+ New Category/i })).toBeNull();
  });

  it('opens the new-category modal when an admin clicks "+ New Category"', () => {
    setupUrqlQueries(
      new Map([[ForumCategoriesDocument, { data: { forumCategories: [SAMPLE_CATEGORY()] } }]]),
    );

    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ New Category/i }));
    expect(screen.getByText('New Forum Category')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/General Discussion/i)).toBeInTheDocument();
  });

  it('honors the controlled isCreateModalOpen prop so a parent header button can drive the modal', () => {
    setupUrqlQueries(
      new Map([[ForumCategoriesDocument, { data: { forumCategories: [SAMPLE_CATEGORY()] } }]]),
    );

    const onClose = vi.fn();
    render(
      <CommunityForumCategoryList
        communityId="community-1"
        communitySlug="lhr-spotters"
        isAdmin={true}
        showCreateButton={false}
        isCreateModalOpen={true}
        onCreateModalClose={onClose}
      />,
    );

    expect(screen.getByText('New Forum Category')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
