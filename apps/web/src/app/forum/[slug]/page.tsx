'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_FORUM_THREAD } from '@/lib/queries';
import { useGlobalForumCategoriesQuery, useForumThreadsQuery } from '@/lib/generated/graphql';

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

// ─── New Thread Modal ────────────────────────────────────────────────────────

function NewThreadModal({
  categoryId,
  onClose,
  onCreated,
}: {
  categoryId: string;
  onClose: () => void;
  onCreated: () => void;
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
    const result = await createThread({
      categoryId,
      title: title.trim(),
      body: body.trim(),
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      onCreated();
    }
  };

  return (
    <div className={styles.modal} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modalCard}>
        <div className={styles.modalTitle}>New Thread</div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Title *</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title…"
              required
              minLength={3}
              maxLength={200}
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>First post *</label>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post…"
              required
              minLength={1}
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GlobalForumCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [showNewThread, setShowNewThread] = useState(false);

  const [{ data: catData, fetching: catFetching }] = useGlobalForumCategoriesQuery({
    requestPolicy: 'cache-and-network',
  });

  const categories = catData?.globalForumCategories ?? [];
  const category = categories.find((c) => c.slug === slug);

  const [{ data: threadData, fetching: threadFetching }] = useForumThreadsQuery({
    variables: { categoryId: category?.id ?? '' },
    pause: !category?.id,
    requestPolicy: 'cache-and-network',
  });

  const threads = threadData?.forumThreads?.edges?.map((e) => e.node) ?? [];
  const hasNextPage = threadData?.forumThreads?.pageInfo?.hasNextPage ?? false;

  if (catFetching) return <div className={styles.loading}>Loading…</div>;
  if (!category) return <div className={styles.empty}>Category not found.</div>;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/forum">Forum</Link>
        <span>/</span>
        <span>{category.name}</span>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.heroTitle}>{category.name}</h1>
          {category.description && (
            <p className={styles.heroSubtitle}>{category.description}</p>
          )}
        </div>
        {ready && user && (
          <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>
            + New Thread
          </button>
        )}
      </div>

      {/* Thread list */}
      {threadFetching && threads.length === 0 && (
        <div className={styles.loading}>Loading…</div>
      )}

      {!threadFetching && threads.length === 0 && (
        <div className={styles.empty}>No threads yet. Start the first one!</div>
      )}

      {threads.length > 0 && (
        <div className={styles.threadList}>
          {threads.map((thread) => (
            <Link key={thread.id} href={`/forum/${slug}/${thread.id}`} className={styles.threadRow}>
              <div className={styles.threadIcon}>
                {thread.isPinned ? '📌' : thread.isLocked ? '🔒' : '💬'}
              </div>
              <div className={styles.threadBody}>
                <div className={styles.threadTitleRow}>
                  <span className={styles.threadTitle}>{thread.title}</span>
                  {thread.isPinned && <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>}
                  {thread.isLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>Locked</span>}
                </div>
                <div className={styles.threadMeta}>
                  by {thread.author?.profile?.displayName ?? thread.author?.username ?? 'unknown'} · {formatDate(thread.createdAt)}
                </div>
                {thread.firstPost && (
                  <div className={styles.threadPreview}>{thread.firstPost.body.slice(0, 120)}{thread.firstPost.body.length > 120 ? '…' : ''}</div>
                )}
              </div>
              <div className={styles.threadStats}>
                <span className={styles.threadPostCount}>{thread.postCount}</span>
                <span>posts</span>
                <span>{formatDate(thread.lastPostAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNewThread && category && (
        <NewThreadModal
          categoryId={category.id}
          onClose={() => setShowNewThread(false)}
          onCreated={() => { setShowNewThread(false); }}
        />
      )}
    </div>
  );
}
