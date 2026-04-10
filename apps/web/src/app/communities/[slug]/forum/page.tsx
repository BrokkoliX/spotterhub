'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_FORUM_CATEGORY,
  DELETE_FORUM_CATEGORY,
  GET_COMMUNITY,
} from '@/lib/queries';
import type { ForumCategoriesQuery } from '@/lib/generated/graphql';
import { useForumCategoriesQuery } from '@/lib/generated/graphql';

import styles from './page.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── New Category Modal ──────────────────────────────────────────────────────

function NewCategoryModal({
  communityId,
  onClose,
  onCreated,
}: {
  communityId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [, createCategory] = useMutation(CREATE_FORUM_CATEGORY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await createCategory({ communityId, name: name.trim(), description: description.trim() || undefined });
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
        <div className={styles.modalTitle}>New Forum Category</div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Name *</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. General Discussion"
              required
              minLength={2}
              maxLength={80}
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this category about?"
              maxLength={300}
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ForumPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [showNewCategory, setShowNewCategory] = useState(false);

  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [{ data, fetching }, reexecuteQuery] = useForumCategoriesQuery({
    variables: { communityId: communityData?.community?.id ?? '' },
    pause: !communityData?.community?.id,
    requestPolicy: 'cache-and-network',
  });

  const [, deleteCategory] = useMutation(DELETE_FORUM_CATEGORY);

  const community = communityData?.community;
  const categories: ForumCategoriesQuery['forumCategories'] = data?.forumCategories ?? [];

  const myRole = community?.myMembership?.role ?? null;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isMember = !!community?.myMembership;

  const refresh = () => reexecuteQuery({ requestPolicy: 'network-only' });

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}" and all its threads? This cannot be undone.`)) return;
    await deleteCategory({ id });
    refresh();
  };

  if (!community && fetching) return <div className={styles.loading}>Loading…</div>;
  if (!community) return <div className={styles.empty}>Community not found.</div>;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/communities">Communities</Link>
        <span>/</span>
        <Link href={`/communities/${slug}`}>{community.name}</Link>
        <span>/</span>
        <span>Forum</span>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>💬 Forum</h1>
        {ready && user && isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowNewCategory(true)}>
            + New Category
          </button>
        )}
      </div>

      {/* Category list */}
      {fetching && categories.length === 0 && (
        <div className={styles.loading}>Loading…</div>
      )}

      {!fetching && categories.length === 0 && (
        <div className={styles.empty}>
          No forum categories yet.
          {isAdmin && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setShowNewCategory(true)}>
                Create the first category
              </button>
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className={styles.categoryList}>
          {categories.map((cat) => (
            <div key={cat.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <Link
                href={`/communities/${slug}/forum/${cat.slug}`}
                className={styles.categoryCard}
                style={{ flex: 1 }}
              >
                <div className={styles.categoryIcon}>💬</div>
                <div className={styles.categoryBody}>
                  <div className={styles.categoryName}>{cat.name}</div>
                  {cat.description && (
                    <div className={styles.categoryDesc}>{cat.description}</div>
                  )}
                  <div className={styles.categoryMeta}>
                    <span>{cat.threadCount} thread{cat.threadCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {cat.latestThread && (
                  <div className={styles.categoryLatest}>
                    <div style={{ marginBottom: 2, fontSize: '0.6875rem' }}>Latest</div>
                    <div className={styles.categoryLatestTitle}>{cat.latestThread.title}</div>
                    <div style={{ marginTop: 2 }}>by {cat.latestThread.author.username}</div>
                    <div>{formatDate(cat.latestThread.lastPostAt)}</div>
                  </div>
                )}
              </Link>
              {isAdmin && (
                <button
                  className="btn btn-secondary"
                  style={{ flexShrink: 0, alignSelf: 'center', fontSize: '0.75rem', padding: '4px 10px' }}
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  title="Delete category"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNewCategory && community && (
        <NewCategoryModal
          communityId={community.id}
          onClose={() => setShowNewCategory(false)}
          onCreated={() => { setShowNewCategory(false); refresh(); }}
        />
      )}
    </div>
  );
}
