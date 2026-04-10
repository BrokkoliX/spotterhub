'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_FORUM_THREAD,
  DELETE_FORUM_THREAD,
  GET_COMMUNITY,
  GET_FORUM_CATEGORIES,
  GET_FORUM_THREADS,
  LOCK_FORUM_THREAD,
  PIN_FORUM_THREAD,
} from '@/lib/queries';

import styles from '../page.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(iso);
}

// ─── New Thread Form ─────────────────────────────────────────────────────────

function NewThreadForm({
  categoryId,
  onCreated,
  onCancel,
}: {
  categoryId: string;
  onCreated: (threadId: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [, createThread] = useMutation(CREATE_FORUM_THREAD);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await createThread({ categoryId, title: title.trim(), body: body.trim() });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      onCreated(result.data.createForumThread.id);
    }
  };

  return (
    <div className={styles.newThreadForm}>
      <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 16 }}>Start a New Thread</div>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Title *</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            required
            minLength={3}
            maxLength={200}
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Body *</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            required
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Thread'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CategoryPage() {
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [showNewThread, setShowNewThread] = useState(false);

  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: catData }] = useQuery({
    query: GET_FORUM_CATEGORIES,
    variables: { communityId: communityData?.community?.id ?? '' },
    pause: !communityData?.community?.id,
    requestPolicy: 'cache-and-network',
  });

  const community = communityData?.community;
  const category = catData?.forumCategories?.find((c: any) => c.slug === categorySlug);

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: GET_FORUM_THREADS,
    variables: { categoryId: category?.id ?? '', first: 30 },
    pause: !category?.id,
    requestPolicy: 'cache-and-network',
  });

  const [, deleteThread] = useMutation(DELETE_FORUM_THREAD);
  const [, pinThread] = useMutation(PIN_FORUM_THREAD);
  const [, lockThread] = useMutation(LOCK_FORUM_THREAD);

  const threads: any[] = data?.forumThreads?.edges?.map((e: any) => e.node) ?? [];
  const totalCount = data?.forumThreads?.totalCount ?? 0;

  const myRole = community?.myMembership?.role ?? null;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isModerator = isAdmin || myRole === 'moderator';
  const isMember = !!community?.myMembership;

  const refresh = () => reexecuteQuery({ requestPolicy: 'network-only' });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this thread and all its posts?')) return;
    await deleteThread({ id });
    refresh();
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await pinThread({ id, pinned: !pinned });
    refresh();
  };

  const handleLock = async (id: string, locked: boolean) => {
    await lockThread({ id, locked: !locked });
    refresh();
  };

  if (!community) return <div className={styles.loading}>Loading…</div>;
  if (!category && catData) return <div className={styles.empty}>Category not found.</div>;

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
        <span>{category?.name ?? categorySlug}</span>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{category?.name}</h1>
          {category?.description && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
              {category.description}
            </p>
          )}
        </div>
        {ready && user && isMember && (
          <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>
            + New Thread
          </button>
        )}
      </div>

      {/* New thread form */}
      {showNewThread && category && (
        <NewThreadForm
          categoryId={category.id}
          onCreated={(threadId) => {
            router.push(`/communities/${slug}/forum/${categorySlug}/${threadId}`);
          }}
          onCancel={() => setShowNewThread(false)}
        />
      )}

      {/* Thread list */}
      {fetching && threads.length === 0 && (
        <div className={styles.loading}>Loading…</div>
      )}

      {!fetching && threads.length === 0 && (
        <div className={styles.empty}>
          No threads yet.
          {isMember && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>
                Start the first thread
              </button>
            </div>
          )}
        </div>
      )}

      {threads.length > 0 && (
        <div className={styles.threadList}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {totalCount} thread{totalCount !== 1 ? 's' : ''}
          </div>
          {threads.map((thread) => (
            <div key={thread.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link
                href={`/communities/${slug}/forum/${categorySlug}/${thread.id}`}
                className={styles.threadRow}
                style={{ flex: 1 }}
              >
                <div className={styles.threadIcon}>
                  {thread.isLocked ? '🔒' : thread.isPinned ? '📌' : '💬'}
                </div>
                <div className={styles.threadBody}>
                  <div className={styles.threadTitle}>
                    {thread.title}
                    {thread.isPinned && <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>}
                    {thread.isLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>Locked</span>}
                  </div>
                  <div className={styles.threadMeta}>
                    by {thread.author.profile?.displayName || thread.author.username}
                    {' · '}{formatDate(thread.createdAt)}
                  </div>
                </div>
                <div className={styles.threadStats}>
                  <div className={styles.threadPostCount}>{thread.postCount}</div>
                  <div>replies</div>
                  <div style={{ marginTop: 4 }}>{formatRelative(thread.lastPostAt)}</div>
                </div>
              </Link>

              {/* Moderator actions */}
              {isModerator && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                    onClick={() => handlePin(thread.id, thread.isPinned)}
                    title={thread.isPinned ? 'Unpin' : 'Pin'}
                  >
                    {thread.isPinned ? '📌 Unpin' : '📌 Pin'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                    onClick={() => handleLock(thread.id, thread.isLocked)}
                    title={thread.isLocked ? 'Unlock' : 'Lock'}
                  >
                    {thread.isLocked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.6875rem', padding: '2px 8px', color: '#f87171' }}
                    onClick={() => handleDelete(thread.id)}
                    title="Delete thread"
                  >
                    🗑 Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
