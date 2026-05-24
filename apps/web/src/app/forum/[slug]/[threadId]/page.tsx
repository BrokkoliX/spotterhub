'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from 'urql';

import {
  ForumHero,
  PostList,
  ReplyComposer,
  type PostData,
  type PostWithReplies,
} from '@/components/forum';
import { useAuth } from '@/lib/auth';
import {
  CREATE_FORUM_POST,
  DELETE_FORUM_POST,
  DELETE_FORUM_THREAD,
  LOCK_FORUM_THREAD,
  PIN_FORUM_THREAD,
} from '@/lib/queries';
import { useForumThreadQuery, useForumPostsQuery } from '@/lib/generated/graphql';

import styles from '../../page.module.css';
import forumStyles from '@/components/forum/forum.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GlobalForumThreadPage() {
  const { slug, threadId } = useParams<{ slug: string; threadId: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [{ data: threadData, fetching: threadFetching }] = useForumThreadQuery({
    variables: { id: threadId },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: postData, fetching: postFetching }, refreshPosts] = useForumPostsQuery({
    variables: { threadId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  const [, pinThread] = useMutation(PIN_FORUM_THREAD);
  const [, lockThread] = useMutation(LOCK_FORUM_THREAD);
  const [, deletePost] = useMutation(DELETE_FORUM_POST);
  const [, deleteThread] = useMutation(DELETE_FORUM_THREAD);
  const [, createPost] = useMutation(CREATE_FORUM_POST);

  const thread = threadData?.forumThread;
  const posts: PostWithReplies[] = (postData?.forumPosts?.edges?.map((e) => e.node) ??
    []) as PostWithReplies[];

  const isAdmin = ready && user?.role === 'admin';
  const isAuthor = thread?.author?.username === user?.username;
  const isLocked = thread?.isLocked ?? false;

  if (threadFetching && !thread) {
    return (
      <ForumHero
        title="Loading thread…"
        breadcrumbs={[{ label: 'Forum', href: '/forum' }, { label: '…' }]}
      />
    );
  }

  if (!thread) {
    return (
      <ForumHero
        title="Thread not found"
        description="This thread may have been removed or never existed."
        breadcrumbs={[{ label: 'Forum', href: '/forum' }, { label: 'Not found' }]}
      />
    );
  }

  const handlePin = async () => {
    await pinThread({ id: thread.id, pinned: !thread.isPinned });
  };

  const handleLock = async () => {
    await lockThread({ id: thread.id, locked: !thread.isLocked });
  };

  const handleDeleteThread = async () => {
    if (!confirm('Delete this thread and all its posts? This cannot be undone.')) return;
    await deleteThread({ id: thread.id });
    router.push(`/forum/${slug}`);
  };

  const handleDeletePost = async (post: PostData) => {
    if (!confirm('Delete this post?')) return;
    await deletePost({ id: post.id });
    refreshPosts({ requestPolicy: 'network-only' });
  };

  const handleCreatePost = async (body: string) => {
    if (!body) return { error: 'Reply cannot be empty' };
    const result = await createPost({ threadId: thread.id, body });
    if (result.error) {
      return { error: result.error.graphQLErrors?.[0]?.message || result.error.message };
    }
    refreshPosts({ requestPolicy: 'network-only' });
    return { error: null };
  };

  return (
    <>
      <ForumHero
        title={thread.title}
        breadcrumbs={[
          { label: 'Forum', href: '/forum' },
          { label: thread.category?.name ?? slug, href: `/forum/${slug}` },
          { label: thread.title.length > 40 ? `${thread.title.slice(0, 40)}…` : thread.title },
        ]}
        meta={
          <>
            <span>
              by {thread.author?.profile?.displayName ?? thread.author?.username ?? 'unknown'}
            </span>
            <span>{formatDate(thread.createdAt)}</span>
            <span>
              {thread.postCount} post{thread.postCount !== 1 ? 's' : ''}
            </span>
            {thread.isPinned && (
              <span className={`${forumStyles.badge} ${forumStyles.badgePinned}`}>Pinned</span>
            )}
            {thread.isLocked && (
              <span className={`${forumStyles.badge} ${forumStyles.badgeLocked}`}>Locked</span>
            )}
          </>
        }
        action={
          ready && user && (isAdmin || isAuthor) ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePin}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    {thread.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleLock}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    {thread.isLocked ? 'Unlock' : 'Lock'}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDeleteThread}
                style={{ fontSize: '0.8125rem', color: 'var(--color-danger)' }}
              >
                Delete Thread
              </button>
            </div>
          ) : undefined
        }
      />

      <div
        className="container"
        style={{
          paddingTop: 24,
          paddingBottom: 48,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {postFetching && posts.length === 0 && <div className={styles.loading}>Loading posts…</div>}

        {posts.length > 0 && (
          <PostList
            posts={posts}
            viewer={user ? { id: user.id, username: user.username, role: user.role } : null}
            isModerator={!!isAdmin}
            canReply={ready && !!user && !isLocked}
            threadAuthorUsername={thread.author?.username}
            onDelete={handleDeletePost}
            onReply={() => {
              // Global forum currently uses a flat reply composer; scroll to it.
              document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}

        <ReplyComposer
          onSubmit={handleCreatePost}
          isLocked={isLocked}
          isAnonymous={ready && !user}
        />

        {!ready && (
          <div
            style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}
          >
            <Link href="/signin" style={{ color: 'var(--color-accent)' }}>
              Sign in
            </Link>{' '}
            to reply to this thread.
          </div>
        )}
      </div>
    </>
  );
}
