import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as urql from 'urql';
import type { DocumentNode } from 'graphql';

import {
  CommunityFeedBlock,
  HOME_COMMUNITY_BLOCK_WIDGET_ID,
} from '../components/CommunityFeedBlock';
import { GET_COMMUNITIES, GET_ME, GET_RECENT_FORUM_THREADS, MY_COMMUNITIES } from '../lib/queries';

// ─── Auth mock ───────────────────────────────────────────────────────────────
//
// We do not exercise the real AuthProvider here because we need fine-grained
// control over the (user, ready) tuple per test. Mocking the hook is more
// direct than fabricating a /api/auth/me HTTP response per test.

const useAuthMock = vi.fn();
vi.mock('../lib/auth', () => ({
  useAuth: () => useAuthMock(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

interface UseQueryResponse {
  data?: unknown;
  fetching?: boolean;
}

/**
 * Routes each useQuery call to the matching response based on the document
 * passed in. Anything not explicitly matched falls back to an empty
 * response so unrelated child queries (e.g. GET_ME for the dismissal
 * check) don't blow up the test.
 */
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

const SIGNED_OUT_AUTH = { user: null, token: null, ready: true, signIn: vi.fn(), signOut: vi.fn() };
const SIGNED_IN_AUTH = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1', email: 'a@b.com', username: 'pilot', role: 'user' },
  token: null,
  ready: true,
  signIn: vi.fn(),
  signOut: vi.fn(),
  ...overrides,
});

const SAMPLE_COMMUNITY = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  avatarUrl: null,
  memberCount: 42,
});

const SAMPLE_THREAD = (overrides: Record<string, unknown> = {}) => ({
  id: 'thread-1',
  title: 'What lens for evening shots at LHR?',
  postCount: 7,
  lastPostAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1h ago
  category: {
    id: 'cat-1',
    slug: 'general',
    name: 'General',
    community: { id: 'comm-1', slug: 'lhr-spotters', name: 'LHR Spotters' },
  },
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CommunityFeedBlock — variant precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the latest_discussions variant when the user has joined communities AND there is a recent thread inside one', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [
          MY_COMMUNITIES,
          {
            data: {
              myCommunities: [SAMPLE_COMMUNITY('comm-1', 'LHR Spotters')],
            },
          },
        ],
        [
          GET_RECENT_FORUM_THREADS,
          {
            data: {
              recentForumThreads: [SAMPLE_THREAD()],
            },
          },
        ],
      ]),
    );

    render(<CommunityFeedBlock />);

    expect(screen.getByText('Latest discussions')).toBeInTheDocument();
    expect(screen.getByText('What lens for evening shots at LHR?')).toBeInTheDocument();
    // Trending heading must NOT appear when latest_discussions wins
    expect(screen.queryByText('Trending communities')).not.toBeInTheDocument();
  });

  it('renders the your_communities variant when the user has joined communities but no recent threads inside them', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [
          MY_COMMUNITIES,
          {
            data: {
              myCommunities: [
                SAMPLE_COMMUNITY('comm-1', 'LHR Spotters'),
                SAMPLE_COMMUNITY('comm-2', 'JFK Spotters'),
              ],
            },
          },
        ],
        [
          GET_RECENT_FORUM_THREADS,
          {
            data: {
              recentForumThreads: [
                // Thread is in a community the user has NOT joined → not eligible.
                SAMPLE_THREAD({
                  id: 'thread-x',
                  category: {
                    id: 'cat-x',
                    slug: 'general',
                    name: 'General',
                    community: { id: 'comm-99', slug: 'other', name: 'Other' },
                  },
                }),
              ],
            },
          },
        ],
      ]),
    );

    render(<CommunityFeedBlock />);

    expect(screen.getByText('Your communities')).toBeInTheDocument();
    expect(screen.getByText('LHR Spotters')).toBeInTheDocument();
    expect(screen.getByText('JFK Spotters')).toBeInTheDocument();
    expect(screen.queryByText('Latest discussions')).not.toBeInTheDocument();
  });

  it('renders the trending_communities variant for a signed-in user with zero joined communities', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [MY_COMMUNITIES, { data: { myCommunities: [] } }],
        [
          GET_COMMUNITIES,
          {
            data: {
              communities: {
                edges: [
                  { node: SAMPLE_COMMUNITY('comm-10', 'Boeing Lovers') },
                  { node: SAMPLE_COMMUNITY('comm-11', 'Airbus Fans') },
                ],
              },
            },
          },
        ],
      ]),
    );

    render(<CommunityFeedBlock />);

    expect(screen.getByText('Trending communities')).toBeInTheDocument();
    expect(screen.getByText('Boeing Lovers')).toBeInTheDocument();
    expect(screen.getByText('Airbus Fans')).toBeInTheDocument();
  });

  it('renders the trending_communities variant (signup funnel branch) for signed-out users and hides the close button', () => {
    useAuthMock.mockReturnValue(SIGNED_OUT_AUTH);
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [
          GET_COMMUNITIES,
          {
            data: {
              communities: {
                edges: [{ node: SAMPLE_COMMUNITY('comm-10', 'Boeing Lovers') }],
              },
            },
          },
        ],
      ]),
    );

    render(<CommunityFeedBlock />);

    expect(screen.getByText('Trending communities')).toBeInTheDocument();
    expect(screen.getByText('Boeing Lovers')).toBeInTheDocument();
    // Signed-out users see no dismiss affordance — the block is part of the
    // signup conversion funnel for them.
    expect(screen.queryByLabelText('Dismiss community highlights')).not.toBeInTheDocument();
  });
});

describe('CommunityFeedBlock — dismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides immediately on close click and calls dismissFeedWidget with the home_community_block widget ID', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    const executeMutation = setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [MY_COMMUNITIES, { data: { myCommunities: [SAMPLE_COMMUNITY('comm-1', 'LHR Spotters')] } }],
        [GET_RECENT_FORUM_THREADS, { data: { recentForumThreads: [] } }],
      ]),
    );

    const { container } = render(<CommunityFeedBlock />);

    const closeBtn = screen.getByLabelText('Dismiss community highlights');
    expect(screen.getByText('Your communities')).toBeInTheDocument();

    fireEvent.click(closeBtn);

    // Block disappears synchronously — optimistic UI hide.
    expect(screen.queryByText('Your communities')).not.toBeInTheDocument();
    expect(container.querySelector('section')).toBeNull();
    // No height-reserving placeholder either: user-initiated dismissal
    // accepts the one-time layout shift in exchange for fully reclaiming
    // the page real estate.
    expect(screen.queryByTestId('community-feed-placeholder')).not.toBeInTheDocument();

    // Mutation called with the canonical widget ID.
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation).toHaveBeenCalledWith({
      widgetId: HOME_COMMUNITY_BLOCK_WIDGET_ID,
    });
  });

  it('renders nothing when the widget ID is already in dismissedFeedWidgets', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [
          GET_ME,
          {
            data: {
              me: {
                id: 'user-1',
                dismissedFeedWidgets: [HOME_COMMUNITY_BLOCK_WIDGET_ID],
              },
            },
          },
        ],
        [MY_COMMUNITIES, { data: { myCommunities: [SAMPLE_COMMUNITY('comm-1', 'LHR Spotters')] } }],
        [GET_RECENT_FORUM_THREADS, { data: { recentForumThreads: [] } }],
      ]),
    );

    const { container } = render(<CommunityFeedBlock />);

    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByText('Your communities')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-feed-placeholder')).not.toBeInTheDocument();
  });
});

describe('CommunityFeedBlock — render stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not flicker between variants on re-render with stable inputs (per-page-load determinism)', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [
          MY_COMMUNITIES,
          {
            data: {
              myCommunities: [SAMPLE_COMMUNITY('comm-1', 'LHR Spotters')],
            },
          },
        ],
        [
          GET_RECENT_FORUM_THREADS,
          {
            data: {
              recentForumThreads: [SAMPLE_THREAD()],
            },
          },
        ],
      ]),
    );

    const { rerender } = render(<CommunityFeedBlock />);
    expect(screen.getByText('Latest discussions')).toBeInTheDocument();

    rerender(<CommunityFeedBlock />);
    rerender(<CommunityFeedBlock />);

    // Same variant title persists across re-renders.
    expect(screen.getByText('Latest discussions')).toBeInTheDocument();
    expect(screen.queryByText('Your communities')).not.toBeInTheDocument();
    expect(screen.queryByText('Trending communities')).not.toBeInTheDocument();
  });

  it('renders nothing (no section, no placeholder) when no variant is eligible (signed-in, no memberships, no trending data)', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [MY_COMMUNITIES, { data: { myCommunities: [] } }],
        [GET_COMMUNITIES, { data: { communities: { edges: [] } } }],
      ]),
    );

    const { container } = render(<CommunityFeedBlock />);
    expect(container.querySelector('section')).toBeNull();
    // Confirmed-empty steady state: the placeholder is for transient
    // unknowns, not for permanently absent content.
    expect(screen.queryByTestId('community-feed-placeholder')).not.toBeInTheDocument();
  });

  it('renders a height-reserving placeholder while variant queries are still hydrating', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        // Both variant queries report fetching=true with no data yet — the
        // typical state immediately after mount on a slow network. The
        // block does not yet know which variant (if any) will be eligible,
        // so it must reserve space rather than render null.
        [MY_COMMUNITIES, { data: undefined, fetching: true }],
        [GET_COMMUNITIES, { data: undefined, fetching: true }],
      ]),
    );

    const { container } = render(<CommunityFeedBlock />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.getByTestId('community-feed-placeholder')).toBeInTheDocument();
  });

  it('renders a height-reserving placeholder (no <section>) while auth is still resolving (ready=false)', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH({ ready: false }));
    setupUrqlMutation();
    setupUrqlQueries(new Map());

    const { container } = render(<CommunityFeedBlock />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.getByTestId('community-feed-placeholder')).toBeInTheDocument();
  });

  it('uses the correct community-scoped href for thread rows', () => {
    useAuthMock.mockReturnValue(SIGNED_IN_AUTH());
    setupUrqlMutation();
    setupUrqlQueries(
      new Map<DocumentNode, UseQueryResponse>([
        [GET_ME, { data: { me: { id: 'user-1', dismissedFeedWidgets: [] } } }],
        [MY_COMMUNITIES, { data: { myCommunities: [SAMPLE_COMMUNITY('comm-1', 'LHR Spotters')] } }],
        [GET_RECENT_FORUM_THREADS, { data: { recentForumThreads: [SAMPLE_THREAD()] } }],
      ]),
    );

    render(<CommunityFeedBlock />);
    const link = screen.getByRole('link', { name: /What lens for evening shots/i });
    expect(link.getAttribute('href')).toBe('/communities/lhr-spotters/forum/general/thread-1');
  });
});
