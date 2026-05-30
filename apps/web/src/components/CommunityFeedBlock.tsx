'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  DISMISS_FEED_WIDGET,
  GET_COMMUNITIES,
  GET_ME,
  GET_RECENT_FORUM_THREADS,
  MY_COMMUNITIES,
} from '@/lib/queries';

import styles from './CommunityFeedBlock.module.css';

/**
 * Stable widget identifier persisted in `User.dismissedFeedWidgets`. Must
 * match the value the rest of the codebase compares against; if a future
 * change introduces additional widget surfaces, give them their own IDs
 * rather than reusing this one.
 */
export const HOME_COMMUNITY_BLOCK_WIDGET_ID = 'home_community_block';

/**
 * Window (in days) for considering a forum thread "recent" enough to
 * trigger the latest-discussions variant. Matches the value spelled out
 * in docs/community_in_feed_widgets_idea.md.
 */
const RECENT_THREAD_WINDOW_DAYS = 7;

const MAX_COMMUNITIES_SHOWN = 4;
const MAX_THREADS_SHOWN = 3;

/**
 * Module-level lazy capture of the recency cutoff. The cutoff is computed
 * once when the helper is first called and reused for the rest of the
 * page load, which matches the "rotation granularity is per page load"
 * rule in docs/community_in_feed_widgets_idea.md and keeps the impure
 * `Date.now()` call out of the React render path.
 */
let cachedRecencyCutoff: number | null = null;
function getRecencyCutoff(): number {
  if (cachedRecencyCutoff == null) {
    cachedRecencyCutoff = Date.now() - RECENT_THREAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }
  return cachedRecencyCutoff;
}

type Variant = 'latest_discussions' | 'your_communities' | 'trending_communities' | null;

interface CommunityCard {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  memberCount?: number | null;
}

interface ThreadRow {
  id: string;
  title: string;
  postCount: number;
  lastPostAt: string;
  category: {
    id: string;
    slug: string;
    name: string;
    community?: { id: string; slug: string; name: string } | null;
  };
}

function formatMembers(count: number | null | undefined): string {
  if (count == null) return '';
  if (count === 1) return '1 member';
  if (count < 1000) return `${count} members`;
  return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k members`;
}

function buildThreadHref(thread: ThreadRow): string {
  // Forum routes mirror the API's hierarchy: community-scoped categories
  // live under /communities/<slug>/forum/<categorySlug>/<threadId>, while
  // global categories use the top-level /forum/<categorySlug>/<threadId>.
  if (thread.category.community) {
    return `/communities/${thread.category.community.slug}/forum/${thread.category.slug}/${thread.id}`;
  }
  return `/forum/${thread.category.slug}/${thread.id}`;
}

function avatarStyle(avatarUrl: string | null | undefined): React.CSSProperties | undefined {
  if (!avatarUrl) return undefined;
  return { backgroundImage: `url(${avatarUrl})` };
}

function avatarInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '·';
}

/**
 * In-feed block that surfaces one of three community-context variants on
 * the home page. Variant selection follows the precedence ordering laid
 * out in docs/community_in_feed_widgets_idea.md:
 *
 *   latest_discussions > your_communities > trending_communities
 *
 * The block is responsible for its own data fetching, dismissal handling,
 * and signed-in/out branching. The home page is responsible only for
 * placement (anchor point inside the photo grid) and visibility (hidden
 * on non-default tabs and beyond page one).
 */
export function CommunityFeedBlock() {
  const { user, ready } = useAuth();
  const isAuthed = !!user;

  // ─── Optimistic dismissal state ──────────────────────────────────────────
  // Hide instantly on click; the mutation refreshes the cached `me`
  // afterwards. We keep a local boolean rather than relying solely on the
  // urql cache update because the optimistic UI must not flash back if
  // the network response is delayed or fails — the mutation is
  // idempotent server-side, so the worst case is the user sees the block
  // again on the next reload.
  const [optimisticallyDismissed, setOptimisticallyDismissed] = useState(false);

  // Captured once at module load time via getRecencyCutoff(). The cutoff
  // is deterministic across re-renders within a single page load
  // (matching the "rotation granularity is per page load" rule in the
  // design doc) and is read here through a module-level helper so the
  // purity-sensitive Date.now() call lives outside the component body.

  const [{ data: meData }] = useQuery({ query: GET_ME, pause: !isAuthed });
  const dismissedList: string[] = meData?.me?.dismissedFeedWidgets ?? [];
  const isDismissedServerSide = dismissedList.includes(HOME_COMMUNITY_BLOCK_WIDGET_ID);

  const [, dismissWidget] = useMutation(DISMISS_FEED_WIDGET);

  // ─── Variant data sources ────────────────────────────────────────────────
  // Each query is paused unless the variant could plausibly need it, so a
  // signed-out viewer makes one network call (trending), an empty signed-in
  // user makes two (mine + trending fallback), and a signed-in user with
  // memberships makes two (mine + threads). The "your communities" and
  // "latest discussions" variants both need MY_COMMUNITIES — the threads
  // query is pre-filtered server-side by `recentForumThreads` returning
  // *all* recent threads, and the variant logic below intersects with the
  // user's joined community IDs to decide eligibility.

  const [{ data: myCommunitiesData, fetching: myCommunitiesFetching }] = useQuery({
    query: MY_COMMUNITIES,
    pause: !isAuthed,
  });
  // Stable reference: `?? []` would allocate a fresh empty array each
  // render and break downstream useMemo dep equality checks.
  const myCommunities = useMemo<CommunityCard[]>(
    () => myCommunitiesData?.myCommunities ?? [],
    [myCommunitiesData],
  );

  const hasJoinedCommunities = myCommunities.length > 0;

  const [{ data: threadsData, fetching: threadsFetching }] = useQuery({
    query: GET_RECENT_FORUM_THREADS,
    variables: { first: 10 },
    pause: !isAuthed || !hasJoinedCommunities,
  });
  const recentThreads = useMemo<ThreadRow[]>(
    () => threadsData?.recentForumThreads ?? [],
    [threadsData],
  );

  const [{ data: trendingData, fetching: trendingFetching }] = useQuery({
    query: GET_COMMUNITIES,
    variables: { first: MAX_COMMUNITIES_SHOWN, sort: 'popular' },
    // Only the trending-communities variant uses this data, so pause when
    // we know we will not render that variant. (Signed-in users with
    // memberships render `your_communities` or `latest_discussions`.)
    pause: isAuthed && hasJoinedCommunities,
  });
  const trendingCommunities = useMemo<CommunityCard[]>(
    () => trendingData?.communities?.edges?.map((e: { node: CommunityCard }) => e.node) ?? [],
    [trendingData],
  );

  // ─── Variant selection ───────────────────────────────────────────────────
  // The selection is computed once per render via useMemo so re-renders
  // inside a single page load do not flicker between variants while the
  // queries hydrate. Selection is deterministic given the inputs, which
  // matches the "rotation granularity is per page load" rule in the doc.

  const eligibleThreads = useMemo<ThreadRow[]>(() => {
    if (!isAuthed || !hasJoinedCommunities) return [];
    const cutoff = getRecencyCutoff();
    const joinedIds = new Set(myCommunities.map((c) => c.id));
    return recentThreads.filter((t) => {
      const inJoined = !!t.category.community && joinedIds.has(t.category.community.id);
      if (!inJoined) return false;
      const lastActivityMs = new Date(t.lastPostAt).getTime();
      return Number.isFinite(lastActivityMs) && lastActivityMs >= cutoff;
    });
  }, [isAuthed, hasJoinedCommunities, myCommunities, recentThreads]);

  const variant: Variant = useMemo(() => {
    if (isAuthed && eligibleThreads.length > 0) return 'latest_discussions';
    if (isAuthed && hasJoinedCommunities) return 'your_communities';
    if (trendingCommunities.length > 0) return 'trending_communities';
    return null;
  }, [isAuthed, eligibleThreads.length, hasJoinedCommunities, trendingCommunities.length]);

  // ─── Visibility checks ───────────────────────────────────────────────────
  // Transient "we don't know yet" states render an invisible placeholder
  // of the same height as a populated block, so the second photo grid on
  // the home page does not jump when the real block resolves in. The
  // placeholder is dropped (and the second grid moves up) only for
  // intentional dismissal — that one-time shift is acceptable because
  // the user initiated it — and for the confirmed steady state where no
  // variant is eligible, where reserving permanent empty space would be
  // a worse outcome than the absent block itself.

  const placeholder = (
    <div
      className={styles.placeholder}
      aria-hidden="true"
      data-testid="community-feed-placeholder"
    />
  );

  if (optimisticallyDismissed) return null;
  if (isAuthed && isDismissedServerSide) return null;
  if (!ready) return placeholder;
  if (variant === null) {
    const stillFetching = myCommunitiesFetching || threadsFetching || trendingFetching;
    if (stillFetching) return placeholder;
    return null;
  }

  const handleDismiss = () => {
    setOptimisticallyDismissed(true);
    dismissWidget({ widgetId: HOME_COMMUNITY_BLOCK_WIDGET_ID }).catch(() => {
      // Idempotent server-side; nothing to recover here. The next page
      // load will re-fetch `me` and either confirm the dismissal or show
      // the block again, which is the correct fallback.
    });
  };

  return (
    <section className={styles.block} aria-label="Community highlights">
      <div className={styles.header}>
        <div>
          {variant === 'latest_discussions' && (
            <>
              <h2 className={styles.title}>Latest discussions</h2>
              <p className={styles.subtitle}>From communities you&rsquo;ve joined</p>
            </>
          )}
          {variant === 'your_communities' && (
            <>
              <h2 className={styles.title}>Your communities</h2>
              <p className={styles.subtitle}>Jump back into the groups you&rsquo;ve joined</p>
            </>
          )}
          {variant === 'trending_communities' && (
            <>
              <h2 className={styles.title}>Trending communities</h2>
              <p className={styles.subtitle}>
                {isAuthed
                  ? 'Discover groups other spotters are joining'
                  : 'Join a community to keep up with other spotters'}
              </p>
            </>
          )}
        </div>
        {isAuthed && (
          <button
            type="button"
            className={styles.close}
            onClick={handleDismiss}
            aria-label="Dismiss community highlights"
            title="Hide this section"
          >
            ✕
          </button>
        )}
      </div>

      {variant === 'latest_discussions' && (
        <div className={styles.threadList}>
          {eligibleThreads.slice(0, MAX_THREADS_SHOWN).map((thread) => (
            <Link key={thread.id} href={buildThreadHref(thread)} className={styles.threadRow}>
              <div>
                <h3 className={styles.threadTitle}>{thread.title}</h3>
                <p className={styles.threadMeta}>
                  {thread.category.community?.name ?? thread.category.name}
                </p>
              </div>
              <span className={styles.threadStats}>
                💬 {thread.postCount} {thread.postCount === 1 ? 'post' : 'posts'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {(variant === 'your_communities' || variant === 'trending_communities') && (
        <div className={styles.cardRow}>
          {(variant === 'your_communities' ? myCommunities : trendingCommunities)
            .slice(0, MAX_COMMUNITIES_SHOWN)
            .map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className={styles.card}
              >
                <span
                  className={styles.cardAvatar}
                  style={avatarStyle(community.avatarUrl)}
                  aria-hidden="true"
                >
                  {!community.avatarUrl && avatarInitial(community.name)}
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardName}>{community.name}</span>
                  <span className={styles.cardMeta}>{formatMembers(community.memberCount)}</span>
                </span>
              </Link>
            ))}
        </div>
      )}
    </section>
  );
}
