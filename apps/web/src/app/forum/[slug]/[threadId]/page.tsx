'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Reply Composer ────────────────────────────────────────────────────────

function ReplyComposer({
  threadId,
  onPosted,
}: {
  threadId: string;
  onPosted: () => void;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [, createPost] = useMutation(CREATE_FORUM_POST);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await createPost({ threadId, body: body.trim() });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      setBody('');
      onPosted();
    }
  };

  return (
    <div className={styles.composer}>
      <div className={styles.composerTitle}>Post a reply</div>
      <form onSubmit={handleSubmit}>
        <textarea
          className={styles.composerTextarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply…"
          required
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.composerActions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Reply'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GlobalForumThreadPage() {
  const { slug, threadId } = useParams<{ slug: string; threadId: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  // Track which posts have their replies expanded
  const [collapsedReplies, setCollapsedReplies] = useState<Record<string, boolean>>({});
  const toggleReplies = (postId: string) =>
    setCollapsedReplies((prev) => ({ ...prev, [postId]: !prev[postId] }));

  const [{ data: threadData, fetching: threadFetching }] = useForumThreadQuery({
    variables: { id: threadId },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: postData, fetching: postFetching }] = useForumPostsQuery({
    variables: { threadId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  const [, pinThread] = useMutation(PIN_FORUM_THREAD);
  const [, lockThread] = useMutation(LOCK_FORUM_THREAD);
  const [, deletePost] = useMutation(DELETE_FORUM_POST);
  const [, deleteThread] = useMutation(DELETE_FORUM_THREAD);

  const thread = threadData?.forumThread;
  const posts = postData?.forumPosts?.edges?.map((e) => e.node) ?? [];

  const isAdmin = ready && user?.role === 'admin';
  const isAuthor = thread?.author?.username === user?.username;

  const handlePin = async () => {
    if (!thread) return;
    await pinThread({ id: thread.id, pinned: !thread.isPinned });
  };

  const handleLock = async () => {
    if (!thread) return;
    await lockThread({ id: thread.id, locked: !thread.isLocked });
  };

  const handleDeleteThread = async () => {
    if (!thread) return;
    if (!confirm('Delete this thread and all its posts? This cannot be undone.')) return;
    await deleteThread({ id: thread.id });
    router.push(`/forum/${slug}`);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    await deletePost({ id: postId });
  };

  if (threadFetching) return <div className={styles.loading}>Loading…</div>;
  if (!thread) return <div className={styles.empty}>Thread not found.</div>;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/forum">Forum</Link>
        <span>/</span>
        <Link href={`/forum/${slug}`}>{thread.category?.name ?? slug}</Link>
        <span>/</span>
        <span>Thread</span>
      </nav>

      {/* Thread header */}
      <div className={styles.threadHeader}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h1 className={styles.threadTitle2}>{thread.title}</h1>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {thread.isPinned && <span className={`${styles.badge} ${styles.badgePinned}`}>📌 Pinned</span>}
            {thread.isLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>🔒 Locked</span>}
          </div>
        </div>
        <div className={styles.threadHeaderMeta}>
          <span>by {thread.author?.profile?.displayName ?? thread.author?.username ?? 'unknown'}</span>
          <span>·</span>
          <span>{formatDate(thread.createdAt)}</span>
          <span>·</span>
          <span>{thread.postCount} post{thread.postCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Thread actions */}
        {ready && user && (isAdmin || isAuthor) && (
          <div className={styles.threadActions}>
            {isAdmin && (
              <>
                <button className="btn btn-secondary" onClick={handlePin} style={{ fontSize: '0.8125rem' }}>
                  {thread.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button className="btn btn-secondary" onClick={handleLock} style={{ fontSize: '0.8125rem' }}>
                  {thread.isLocked ? 'Unlock' : 'Lock'}
                </button>
              </>
            )}
            {(isAdmin || isAuthor) && (
              <button className="btn btn-secondary" onClick={handleDeleteThread} style={{ fontSize: '0.8125rem', color: '#f87171' }}>
                Delete Thread
              </button>
            )}
          </div>
        )}
      </div>

      {/* Posts */}
      {postFetching && posts.length === 0 && (
        <div className={styles.loading}>Loading…</div>
      )}

      {posts.length > 0 && (
        <div className={styles.postList}>
          {posts.map((post) => (
            <div key={post.id} className={styles.post}>
              <div className={styles.postHeader}>
                <div className={styles.postAvatar}>
                  {post.author?.profile?.displayName ? getInitials(post.author.profile.displayName) : '?'}
                </div>
                <div className={styles.postAuthor}>
                  {post.author?.profile?.displayName ?? post.author?.username ?? 'unknown'}
                </div>
                <div className={styles.postDate}>
                  {formatDate(post.createdAt)} at {formatTime(post.createdAt)}
                </div>
                {ready && user && (isAdmin || user.username === post.author?.username) && (
                  <button
                    className={styles.postAction}
                    style={{ marginLeft: 'auto', color: '#f87171' }}
                    onClick={() => handleDeletePost(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
              {post.isDeleted ? (
                <div className={styles.postDeleted}>[This post has been deleted]</div>
              ) : (
                <div className={styles.postBody}>{post.body}</div>
              )}

              {/* Replies */}
              {post.replies && post.replies.length > 0 && (
                <div className={styles.replies}>
                  <button
                    className={styles.collapseBtn}
                    onClick={() => toggleReplies(post.id)}
                  >
                    {collapsedReplies[post.id] ? '▶' : '▼'} {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
                  </button>
                  {!collapsedReplies[post.id] && post.replies.map((reply) => (
                    <div key={reply.id} className={styles.reply}>
                      <div className={styles.postHeader}>
                        <div className={styles.postAvatar} style={{ width: 24, height: 24, fontSize: '0.6875rem' }}>
                          {reply.author?.profile?.displayName ? getInitials(reply.author.profile.displayName) : '?'}
                        </div>
                        <div className={styles.postAuthor} style={{ fontSize: '0.8125rem' }}>
                          {reply.author?.profile?.displayName ?? reply.author?.username ?? 'unknown'}
                        </div>
                        <div className={styles.postDate} style={{ fontSize: '0.6875rem' }}>
                          {formatDate(reply.createdAt)}
                        </div>
                        {ready && user && (isAdmin || user.username === reply.author?.username) && (
                          <button
                            className={styles.postAction}
                            style={{ marginLeft: 'auto', color: '#f87171' }}
                            onClick={() => handleDeletePost(reply.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {reply.isDeleted ? (
                        <div className={styles.postDeleted}>[deleted]</div>
                      ) : (
                        <div className={styles.postBody} style={{ fontSize: '0.875rem', padding: '12px 16px' }}>{reply.body}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
      {ready && user ? (
        thread.isLocked ? (
          <div className={styles.lockedMsg}>🔒 This thread is locked and no longer accepts replies.</div>
        ) : (
          <ReplyComposer threadId={thread.id} onPosted={() => {}} />
        )
      ) : (
        <div className={styles.lockedMsg}>
          <Link href="/signin">Sign in</Link> to reply to this thread.
        </div>
      )}
    </div>
  );
}
