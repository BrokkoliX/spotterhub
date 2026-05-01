'use client';

import { type FormEvent, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_GLOBAL_FORUM_CATEGORY,
  DELETE_FORUM_CATEGORY,
  GET_GLOBAL_FORUM_CATEGORIES,
  UPDATE_FORUM_CATEGORY,
} from '@/lib/queries';

import styles from '../page.module.css';

type ForumCategoryNode = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  position: number;
  threadCount: number;
};

export default function AdminForumCategoriesPage() {
  const { user, ready } = useAuth();
  // Only admin and superuser can manage global forum categories (matches backend requireAdmin).
  const isAdmin = user && (user.role === 'admin' || user.role === 'superuser');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', slug: '', position: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [result, reexecute] = useQuery({
    query: GET_GLOBAL_FORUM_CATEGORIES,
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [, createGlobalForumCategory] = useMutation(CREATE_GLOBAL_FORUM_CATEGORY);
  const [, updateForumCategory] = useMutation(UPDATE_FORUM_CATEGORY);
  const [, deleteForumCategory] = useMutation(DELETE_FORUM_CATEGORY);

  const categories: ForumCategoryNode[] = data?.globalForumCategories ?? [];

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', slug: '', position: String(categories.length + 1) });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (node: ForumCategoryNode) => {
    setEditingId(node.id);
    setFormData({
      name: node.name,
      description: node.description ?? '',
      slug: node.slug,
      position: String(node.position),
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    const description = formData.description.trim();
    const slug = formData.slug.trim();

    if (!name) {
      setFormError('Name is required');
      return;
    }

    setFormLoading(true);

    let res;
    if (editingId) {
      const position = formData.position ? parseInt(formData.position, 10) : undefined;
      res = await updateForumCategory({
        id: editingId,
        name,
        description: description || null,
        position,
      });
    } else {
      // Slug is auto-generated server-side from name when omitted; only send if user overrides.
      res = await createGlobalForumCategory({
        name,
        description: description || null,
        slug: slug || null,
      });
    }

    setFormLoading(false);
    if (res.error) {
      setFormError(res.error.graphQLErrors[0]?.message ?? 'Failed');
      return;
    }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? All threads and posts in it will also be removed.`)) return;
    const res = await deleteForumCategory({ id });
    if (res.error) {
      alert(res.error.graphQLErrors[0]?.message ?? 'Failed to delete category');
      return;
    }
    reexecute({ requestPolicy: 'network-only' });
  };

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Forum Categories</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Global forum categories shown on the site-wide <code>/forum</code> page. Community-specific
          forums are managed from each community&apos;s settings.
        </p>

        <div className={styles.filters}>
          <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>
            + Add Category
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {fetching && <div className={styles.loading}>Loading…</div>}
        {error && <div className={styles.loading}>Error loading categories</div>}

        {categories.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Position</th>
                <th>Threads</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...categories]
                .sort((a, b) => a.position - b.position)
                .map((node) => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>
                      <code style={{ fontSize: '0.8125rem' }}>{node.slug}</code>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {node.description || <span style={{ opacity: 0.5 }}>—</span>}
                    </td>
                    <td>{node.position}</td>
                    <td>{node.threadCount}</td>
                    <td>
                      <button className={styles.actionBtn} onClick={() => openEdit(node)}>
                        Edit
                      </button>
                      <button
                        className={styles.actionBtnDanger}
                        onClick={() => handleDelete(node.id, node.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {categories.length === 0 && !fetching && (
          <div className={styles.loading}>No forum categories yet. Add one to get started.</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '100%',
              maxWidth: 520,
            }}
          >
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>
              {editingId ? 'Edit Forum Category' : 'Add Forum Category'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="General Discussion"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional short description shown under the category title"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {!editingId && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                    Slug
                  </label>
                  <input
                    className="input"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated from name if left blank"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {editingId && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                    Position
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="1"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {formError && (
                <p className="error-text" style={{ marginBottom: 12 }}>
                  {formError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
