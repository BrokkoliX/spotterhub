import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { ThreadCard, type ThreadCardData } from '../components/forum/ThreadCard';
import { ThreadList } from '../components/forum/ThreadList';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockThread(overrides: Partial<ThreadCardData> = {}): ThreadCardData {
  return {
    id: 'thread-1',
    title: 'What lens for evening shots at LHR?',
    isPinned: false,
    isLocked: false,
    postCount: 7,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    lastPostAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    author: {
      username: 'avspotter',
      profile: { displayName: 'Av Spotter', avatarUrl: null },
    },
    firstPost: {
      body: 'Looking for recommendations on telephoto glass for golden hour at Heathrow…',
    },
    ...overrides,
  };
}

// ─── ThreadCard ─────────────────────────────────────────────────────────────

describe('ThreadCard', () => {
  it('renders title, snippet, byline and post count', () => {
    const thread = createMockThread();
    render(<ThreadCard thread={thread} href="/forum/general/thread-1" />);

    expect(screen.getByRole('heading', { name: thread.title })).toBeInTheDocument();
    expect(screen.getByText(/Looking for recommendations on telephoto glass/i)).toBeInTheDocument();
    expect(screen.getByText(/by Av Spotter/i)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('posts')).toBeInTheDocument();
  });

  it('uses the singular "post" label when post count is 1', () => {
    render(
      <ThreadCard thread={createMockThread({ postCount: 1 })} href="/forum/general/thread-1" />,
    );
    expect(screen.getByText('post')).toBeInTheDocument();
    expect(screen.queryByText('posts')).not.toBeInTheDocument();
  });

  it('shows the Pinned badge for pinned threads', () => {
    render(<ThreadCard thread={createMockThread({ isPinned: true })} href="/x" />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('shows the Locked badge for locked threads', () => {
    render(<ThreadCard thread={createMockThread({ isLocked: true })} href="/x" />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('renders the link with the supplied href and aria-label', () => {
    const thread = createMockThread();
    render(<ThreadCard thread={thread} href="/forum/general/thread-1" />);
    const link = screen.getByRole('link', { name: `Thread: ${thread.title}` });
    expect(link).toHaveAttribute('href', '/forum/general/thread-1');
  });

  it('falls back to username when display name is missing', () => {
    const thread = createMockThread({
      author: { username: 'pilotjoe', profile: null },
    });
    render(<ThreadCard thread={thread} href="/x" />);
    expect(screen.getByText(/by pilotjoe/i)).toBeInTheDocument();
  });
});

// ─── ThreadList ─────────────────────────────────────────────────────────────

describe('ThreadList', () => {
  it('groups pinned threads under a "Pinned" header and the rest under "Latest"', () => {
    const threads = [
      createMockThread({ id: 't1', title: 'Welcome — read me first', isPinned: true }),
      createMockThread({ id: 't2', title: 'Best gear for night shots' }),
      createMockThread({ id: 't3', title: 'Trip report: SFO this weekend' }),
    ];

    render(
      <ThreadList
        threads={threads}
        buildHref={(t) => `/forum/general/${t.id}`}
        fetching={false}
        totalCount={2}
      />,
    );

    // "Pinned" appears twice: once as the section header, once as the badge
    // on the pinned thread card. Both are intentional.
    expect(screen.getAllByText('Pinned').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Latest')).toBeInTheDocument();

    // Pinned thread title is present
    expect(screen.getByRole('heading', { name: 'Welcome — read me first' })).toBeInTheDocument();
    // Regular threads are present
    expect(screen.getByRole('heading', { name: 'Best gear for night shots' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Trip report: SFO this weekend' }),
    ).toBeInTheDocument();
  });

  it('uses the "Threads" group header when there are no pinned threads', () => {
    const threads = [createMockThread({ id: 't1' })];
    render(
      <ThreadList
        threads={threads}
        buildHref={(t) => `/forum/general/${t.id}`}
        fetching={false}
        totalCount={1}
      />,
    );

    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
    expect(screen.queryByText('Latest')).not.toBeInTheDocument();
  });

  it('renders an empty-state panel when there are no threads', () => {
    render(
      <ThreadList
        threads={[]}
        buildHref={() => '/x'}
        fetching={false}
        emptyState={<div>Be the first to start a discussion.</div>}
      />,
    );

    expect(screen.getByText(/be the first to start a discussion/i)).toBeInTheDocument();
  });

  it('builds the thread link via the buildHref prop so the same component works for global and community routes', () => {
    const threads = [createMockThread({ id: 't1', title: 'Shared component test' })];
    const { container } = render(
      <ThreadList
        threads={threads}
        buildHref={(t) => `/communities/heathrow/forum/general/${t.id}`}
        fetching={false}
      />,
    );

    const link = within(container).getByRole('link', { name: /Shared component test/i });
    expect(link).toHaveAttribute('href', '/communities/heathrow/forum/general/t1');
  });
});
