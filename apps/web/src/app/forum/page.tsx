'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_GLOBAL_FORUM_CATEGORY,
  DELETE_FORUM_CATEGORY,
} from '@/lib/queries';
import { useGlobalForumCategoriesQuery } from '@/lib/generated/graphql';

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
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [, createCategory] = useMutation(CREATE_GLOBAL_FORUM_CATEGORY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await createCategory({
      name: name.trim(),
      description: description.trim() || undefined,
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

export default function GlobalForumPage() {
  const { user, ready } = useAuth();
  const [showNewCategory, setShowNewCategory] = useState(false);

  const [{ data, fetching }] = useGlobalForumCategoriesQuery({
    requestPolicy: 'cache-and-network',
  });

  const [, deleteCategory] = useMutation(DELETE_FORUM_CATEGORY);

  const categories = data?.globalForumCategories ?? [];
  const isAdmin = ready && user?.role === 'admin';

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}" and all its threads? This cannot be undone.`)) return;
    await deleteCategory({ id });
  };

  return (
    <div>
      {/* Hero Banner */}
      <div className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroEmoji}>💬</div>
          <h1 className={styles.heroTitle}>Global Forum</h1>
          <p className={styles.heroSubtitle}>
            Aviation discussion from across the SpotterHub community
          </p>
        </div>
      </div>

      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.sectionTitle}>Categories</h2>
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
          <div className={styles.categoryGrid}>
            {categories.map((cat) => (
              <div key={cat.id} className={styles.categoryRow}>
                <Link href={`/forum/${cat.slug}`} className={styles.categoryCard}>
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
                      <div className={styles.categoryLatestLabel}>Latest</div>
                      <div className={styles.categoryLatestTitle}>{cat.latestThread.title}</div>
                      <div className={styles.categoryLatestMeta}>
                        by {cat.latestThread.author?.username ?? 'unknown'} · {formatDate(cat.latestThread.lastPostAt)}
                      </div>
                    </div>
                  )}
                </Link>
                {isAdmin && (
                  <button
                    className={styles.deleteBtn}
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
      </div>

      {showNewCategory && (
        <NewCategoryModal
          onClose={() => setShowNewCategory(false)}
          onCreated={() => { setShowNewCategory(false); }}
        />
      )}
    </div>
  );
}
