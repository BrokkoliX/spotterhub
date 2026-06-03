'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from 'urql';

import { CREATE_FORUM_CATEGORY, DELETE_FORUM_CATEGORY } from '@/lib/queries';
import type { ForumCategoriesQuery } from '@/lib/generated/graphql';
import { useForumCategoriesQuery } from '@/lib/generated/graphql';

import styles from './forum.module.css';
import categoryStyles from './communityForumCategoryList.module.css';

type ForumCategory = ForumCategoriesQuery['forumCategories'][number];

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
    const result = await createCategory({
      communityId,
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
    <div
      className={categoryStyles.modal}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={categoryStyles.modalCard}>
        <div className={categoryStyles.modalTitle}>New Forum Category</div>
        <form onSubmit={handleSubmit}>
          <div className={categoryStyles.formGroup}>
            <label className={categoryStyles.label}>Name *</label>
            <input
              className={categoryStyles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. General Discussion"
              required
              minLength={2}
              maxLength={80}
              autoFocus
            />
          </div>
          <div className={categoryStyles.formGroup}>
            <label className={categoryStyles.label}>Description</label>
            <textarea
              className={categoryStyles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this category about?"
              maxLength={300}
            />
          </div>
          {error && <div className={categoryStyles.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CommunityForumCategoryList ──────────────────────────────────────────────

export interface CommunityForumCategoryListProps {
  communityId: string;
  communitySlug: string;
  isAdmin: boolean;
  /** When true, the component renders its own "+ New Category" button. */
  showCreateButton?: boolean;
  /** Optional external trigger to open the new-category modal. Pair with `onModalClose`. */
  isCreateModalOpen?: boolean;
  /** Called when the modal closes (cancelled or after a successful create). */
  onCreateModalClose?: () => void;
}

export function CommunityForumCategoryList({
  communityId,
  communitySlug,
  isAdmin,
  showCreateButton = true,
  isCreateModalOpen,
  onCreateModalClose,
}: CommunityForumCategoryListProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const modalOpen = isCreateModalOpen ?? internalModalOpen;

  const closeModal = () => {
    setInternalModalOpen(false);
    onCreateModalClose?.();
  };

  const [{ data, fetching }, reexecuteQuery] = useForumCategoriesQuery({
    variables: { communityId },
    pause: !communityId,
    requestPolicy: 'cache-and-network',
  });

  const [, deleteCategory] = useMutation(DELETE_FORUM_CATEGORY);

  const categories: ForumCategory[] = data?.forumCategories ?? [];

  const refresh = () => reexecuteQuery({ requestPolicy: 'network-only' });

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}" and all its threads? This cannot be undone.`)) return;
    await deleteCategory({ id });
    refresh();
  };

  return (
    <div className={categoryStyles.container}>
      {showCreateButton && isAdmin && (
        <div className={categoryStyles.toolbar}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setInternalModalOpen(true)}
          >
            + New Category
          </button>
        </div>
      )}

      {fetching && categories.length === 0 && (
        <div className={categoryStyles.loading}>Loading…</div>
      )}

      {!fetching && categories.length === 0 && (
        <div className={categoryStyles.empty}>
          No forum categories yet.
          {isAdmin && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setInternalModalOpen(true)}>
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
                href={`/communities/${communitySlug}/forum/${cat.slug}`}
                className={styles.categoryCard}
                style={{ flex: 1 }}
              >
                <div className={styles.categoryIcon}>💬</div>
                <div className={styles.categoryBody}>
                  <div className={styles.categoryName}>{cat.name}</div>
                  {cat.description && <div className={styles.categoryDesc}>{cat.description}</div>}
                  <div className={styles.categoryMeta}>
                    <span>
                      {cat.threadCount} thread{cat.threadCount !== 1 ? 's' : ''}
                    </span>
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
                  style={{
                    flexShrink: 0,
                    alignSelf: 'center',
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                  }}
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

      {modalOpen && (
        <NewCategoryModal
          communityId={communityId}
          onClose={closeModal}
          onCreated={() => {
            closeModal();
            refresh();
          }}
        />
      )}
    </div>
  );
}
