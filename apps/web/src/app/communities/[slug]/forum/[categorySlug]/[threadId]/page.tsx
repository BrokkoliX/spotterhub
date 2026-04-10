'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_FORUM_POST,
  DELETE_FORUM_POST,
  GET_COMMUNITY,
  GET_FORUM_POSTS,
  GET_FORUM_THREAD,
  LOCK_FORUM_THREAD,
  PIN_FORUM_THREAD,
  UPDATE_FORUM_POST,
} from '@/lib/queries';

import styles from '../../page.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function authorLabel(author: any) {
  return author?.profile?.displayName || author?.username || 'Unknown';
}

function authorInitial(author: any) {
  return (authorLabel(author)).charAt(0).toUpperCase();
}

// ─── Post component ──────────────────────────────────────────────────────────

function PostItem({
  post,
  me,
  isModerator,
  isMember,
  isLocked,
  onReply,
  onDelete,
  onEdit,
  indent = false,
}: {
  post: any;
  me: any;
  isModerator: boolean;
  isMember: boolean;
  isLocked: boolean;
  onReply: (postId: string, authorName: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, body: string) => void;
  indent?: boolean;
}) {
  const isAuthor = me && post.author?.username === me.username;
  const canDelete = isAuthor || isModerator;
  const canEdit = isAuthor && !post.isDeleted;
  const canReply = isMember && !isLocked && !post.isDeleted;

  return (
    <div className={`${styles.post} ${indent ? styles.reply : ''}`}>
      <div className={styles.postHeader}>
        <div className={styles.postAvatar}>{authorInitial(post.author)}</div>
        <div>
          <Link
            href={`/u/${post.author?.username}/photos`}
            className={styles.postAuthor}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {authorLabel(post.author)}
          </Link>
        </div>
        <div className={styles.postDate}>{formatDate(post.createdAt)}</div>
      </div>

      {post.isDeleted ? (
        <div className={styles.postDeleted}>[deleted]</div>
      ) : (
        <div className={styles.postBody}>{post.body}</div>
      )}

      {!post.isDeleted && (
        <div className={styles.postActions}>
          {canReply && (
            <button
              className={styles.postAction}
              onClick={() => onReply(post.id, authorLabel(post.author))}
            >
              ↩ Reply
            </button>
          )}
          {canEdit && (
            <button className={styles.postAction} onClick={() => onEdit(post.id, post.body)}>
              ✏ Edit
            </button>
          )}
          {canDelete && (
            <button
              className={styles.postAction}
              style={{ color: '#f87171' }}
              onClick={() => onDelete(post.id)}
            >
              🗑 Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ThreadPage() {
  const { slug, categorySlug, threadId } = useParams<{
    slug: string;
    categorySlug: string;
    threadId: string;
  }>();
  const { user, ready } = useAuth();

  // Reply / edit state
  const [replyTo, setReplyTo] = useState<{ postId: string; authorName: string } | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Queries
  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: threadData, fetching: threadFetching }] = useQuery({
    query: GET_FORUM_THREAD,
    variables: { id: threadId },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: postsData, fetching: postsFetching }, reexecutePosts] = useQuery({
    query: GET_FORUM_POSTS,
    variables: { threadId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  // Mutations
  const [, createPost] = useMutation(CREATE_FORUM_POST);
  const [, updatePost] = useMutation(UPDATE_FORUM_POST);
  const [, deletePost] = useMutation(DELETE_FORUM_POST);
  const [, pinThread] = useMutation(PIN_FORUM_THREAD);
  const [, lockThread] = useMutation(LOCK_FORUM_THREAD);

  const community = communityData?.community;
  const thread = threadData?.forumThread;
  const posts: any[] = postsData?.forumPosts?.edges?.map((e: any) => e.node) ?? [];
  const totalPosts = postsData?.forumPosts?.totalCount ?? 0;

  const myRole = community?.myMembership?.role ?? null;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isModerator = isAdmin || myRole === 'moderator';
  const isMember = !!community?.myMembership;
  const isLocked = thread?.isLocked ?? false;

  const refreshPosts = () => reexecutePosts({ requestPolicy: 'network-only' });

  // ── Submit reply ──
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError('');
    const body = replyBody.trim();
    if (!body) return;
    setReplySubmitting(true);
    const result = await createPost({
      threadId,
      body,
      parentPostId: replyTo?.postId ?? undefined,
    });
    setReplySubmitting(false);
    if (result.error) {
      setReplyError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      setReplyBody('');
      setReplyTo(null);
      refreshPosts();
    }
  };

  // ── Edit post ──
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostId) return;
    setEditError('');
    setEditSubmitting(true);
    const result = await updatePost({ id: editingPostId, body: editBody.trim() });
    setEditSubmitting(false);
    if (result.error) {
      setEditError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      setEditingPostId(null);
      setEditBody('');
      refreshPosts();
    }
  };

  // ── Delete post ──
  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    await deletePost({ id: postId });
    refreshPosts();
  };

  // ── Pin / lock ──
  const handlePin = async () => {
    if (!thread) return;
    await pinThread({ id: thread.id, pinned: !thread.isPinned });
  };

  const handleLock = async () => {
    if (!thread) return;
    await lockThread({ id: thread.id, locked: !thread.isLocked });
  };

  if (threadFetching && !thread) return <div className={styles.loading}>Loading…</div>;
  if (!thread) return <div className={styles.empty}>Thread not found.</div>;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/communities">Communities</Link>
        <span>/</span>
        <Link href={`/communities/${slug}`}>{community?.name ?? slug}</Link>
        <span>/</span>
        <Link href={`/communities/${slug}/forum`}>Forum</Link>
        <span>/</span>
        <Link href={`/communities/${slug}/forum/${categorySlug}`}>
          {thread.category?.name ?? categorySlug}
        </Link>
        <span>/</span>
        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {thread.title}
        </span>
      </nav>

      {/* Thread header */}
      <div className={styles.threadHeader}>
        <div className={styles.threadTitle2}>
          {thread.isPinned && '📌 '}{thread.title}
          {thread.isLocked && (
            <span className={`${styles.badge} ${styles.badgeLocked}`} style={{ marginLeft: 8 }}>Locked</span>
          )}
        </div>
        <div className={styles.threadHeaderMeta}>
          <span>
            by{' '}
            <Link href={`/u/${thread.author.username}/photos`} style={{ color: 'var(--color-accent)' }}>
              {authorLabel(thread.author)}
            </Link>
          </span>
          <span>{formatDate(thread.createdAt)}</span>
          <span>{totalPosts} post{totalPosts !== 1 ? 's' : ''}</span>
        </div>

        {/* Moderator thread actions */}
        {isModerator && (
          <div className={styles.threadActions}>
            <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }} onClick={handlePin}>
              {thread.isPinned ? '📌 Unpin' : '📌 Pin'}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }} onClick={handleLock}>
              {thread.isLocked ? '🔓 Unlock' : '🔒 Lock'}
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      {postsFetching && posts.length === 0 && (
        <div className={styles.loading}>Loading posts…</div>
      )}

      <div className={styles.postList}>
        {posts.map((post) => (
          <div key={post.id}>
            {editingPostId === post.id ? (
              /* Inline edit form */
              <div className={styles.post}>
                <div className={styles.postHeader}>
                  <div className={styles.postAvatar}>{authorInitial(post.author)}</div>
                  <div className={styles.postAuthor}>{authorLabel(post.author)}</div>
                </div>
                <form onSubmit={handleEditSubmit} style={{ padding: 16 }}>
                  <textarea
                    className={styles.composerTextarea}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    required
                    autoFocus
                  />
                  {editError && <div className={styles.error}>{editError}</div>}
                  <div className={styles.composerActions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setEditingPostId(null); setEditBody(''); }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                      {editSubmitting ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <PostItem
                post={post}
                me={user}
                isModerator={isModerator}
                isMember={isMember}
                isLocked={isLocked}
                onReply={(postId, authorName) => {
                  setReplyTo({ postId, authorName });
                  setReplyBody('');
                  // Scroll to composer
                  document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' });
                }}
                onDelete={handleDelete}
                onEdit={(postId, body) => {
                  setEditingPostId(postId);
                  setEditBody(body);
                }}
              />
            )}

            {/* Nested replies */}
            {post.replies && post.replies.length > 0 && (
              <div className={styles.replies}>
                {post.replies.map((reply: any) => (
                  editingPostId === reply.id ? (
                    <div key={reply.id} className={styles.reply}>
                      <div className={styles.postHeader}>
                        <div className={styles.postAvatar}>{authorInitial(reply.author)}</div>
                        <div className={styles.postAuthor}>{authorLabel(reply.author)}</div>
                      </div>
                      <form onSubmit={handleEditSubmit} style={{ padding: 16 }}>
                        <textarea
                          className={styles.composerTextarea}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          required
                          autoFocus
                        />
                        {editError && <div className={styles.error}>{editError}</div>}
                        <div className={styles.composerActions}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => { setEditingPostId(null); setEditBody(''); }}
                          >
                            Cancel
                          </button>
                          <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                            {editSubmitting ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <PostItem
                      key={reply.id}
                      post={reply}
                      me={user}
                      isModerator={isModerator}
                      isMember={isMember}
                      isLocked={isLocked}
                      onReply={(postId, authorName) => {
                        setReplyTo({ postId, authorName });
                        setReplyBody('');
                        document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      onDelete={handleDelete}
                      onEdit={(postId, body) => {
                        setEditingPostId(postId);
                        setEditBody(body);
                      }}
                      indent
                    />
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply composer */}
      {ready && user && isMember && (
        <div className={styles.composer} id="composer">
          {isLocked ? (
            <div className={styles.lockedMsg}>🔒 This thread is locked and no longer accepts replies.</div>
          ) : (
            <>
              <div className={styles.composerTitle}>
                {replyTo ? `↩ Replying to ${replyTo.authorName}` : 'Add a Reply'}
              </div>
              {replyTo && (
                <div className={styles.replyingTo}>
                  <span>Replying to <strong>{replyTo.authorName}</strong></span>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}
                    onClick={() => setReplyTo(null)}
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
              <form onSubmit={handleReplySubmit}>
                <textarea
                  className={styles.composerTextarea}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write your reply…"
                  required
                />
                {replyError && <div className={styles.error}>{replyError}</div>}
                <div className={styles.composerActions}>
                  {replyTo && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setReplyTo(null); setReplyBody(''); }}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={replySubmitting}>
                    {replySubmitting ? 'Posting…' : 'Post Reply'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {ready && !user && (
        <div className={styles.composer} id="composer">
          <div className={styles.lockedMsg}>
            <Link href="/signin" style={{ color: 'var(--color-accent)' }}>Sign in</Link> to join the discussion.
          </div>
        </div>
      )}
    </div>
  );
}
