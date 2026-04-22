'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'urql';

import {
  GET_MARKETPLACE_CATEGORIES,
  CREATE_MARKETPLACE_CATEGORY,
  UPDATE_MARKETPLACE_CATEGORY,
  DELETE_MARKETPLACE_CATEGORY,
} from '@/lib/queries';

import styles from './page.module.css';

interface Category {
  id: string;
  name: string;
  label: string;
  sortOrder: number;
  itemCount: number;
}

export default function AdminMarketplaceCategoriesPage() {
  const [{ data, fetching, error }, refetch] = useQuery({
    query: GET_MARKETPLACE_CATEGORIES,
  });

  const [{ fetching: creating }, createMutation] = useMutation(CREATE_MARKETPLACE_CATEGORY);
  const [, updateMutation] = useMutation(UPDATE_MARKETPLACE_CATEGORY);
  const [, deleteMutation] = useMutation(DELETE_MARKETPLACE_CATEGORY);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const categories: Category[] = data?.marketplaceCategories ?? [];

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditLabel(cat.label);
    setEditSortOrder(String(cat.sortOrder));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditLabel('');
    setEditSortOrder('');
  };

  const handleUpdate = async (id: string) => {
    const result = await updateMutation({
      id,
      input: {
        name: editName,
        label: editLabel,
        sortOrder: editSortOrder ? parseInt(editSortOrder, 10) : undefined,
      },
    });
    if (result.error) {
      setActionError(result.error.graphQLErrors?.[0]?.message ?? 'Update failed');
      return;
    }
    cancelEdit();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newLabel.trim()) {
      setActionError('Name and label are required');
      return;
    }
    const result = await createMutation({
      input: {
        name: newName.trim(),
        label: newLabel.trim(),
        sortOrder: newSortOrder ? parseInt(newSortOrder, 10) : 0,
      },
    });
    if (result.error) {
      setActionError(result.error.graphQLErrors?.[0]?.message ?? 'Create failed');
      return;
    }
    setNewName('');
    setNewLabel('');
    setNewSortOrder('');
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Items must be moved or deleted first.')) return;
    const result = await deleteMutation({ id });
    if (result.error) {
      setActionError(result.error.graphQLErrors?.[0]?.message ?? 'Delete failed');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <Link href="/admin" className={styles.backLink}>← Admin</Link>
            <h1 className={styles.title}>Marketplace Categories</h1>
            <p className={styles.subtitle}>Manage categories for collectibles listings.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
          >
            + Add Category
          </button>
        </div>

        {actionError && <p className={styles.error}>{actionError}</p>}

        {fetching ? (
          <p className={styles.loading}>Loading…</p>
        ) : error ? (
          <p className={styles.errorMsg}>Failed to load categories.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sort</th>
                  <th>Name (slug)</th>
                  <th>Label</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    {editingId === cat.id ? (
                      <>
                        <td>
                          <input
                            type="number"
                            className={styles.sortInput}
                            value={editSortOrder}
                            onChange={(e) => setEditSortOrder(e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.nameInput}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="slug-name"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.labelInput}
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Display Name"
                          />
                        </td>
                        <td>{cat.itemCount}</td>
                        <td>
                          <div className={styles.actions}>
                            <button type="button" className={styles.saveBtn} onClick={() => handleUpdate(cat.id)}>Save</button>
                            <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={styles.sortCell}>{cat.sortOrder}</td>
                        <td className={styles.nameCell}>{cat.name}</td>
                        <td className={styles.labelCell}>{cat.label}</td>
                        <td className={styles.countCell}>{cat.itemCount}</td>
                        <td>
                          <div className={styles.actions}>
                            <button type="button" className={styles.editBtn} onClick={() => startEdit(cat)}>Edit</button>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(cat.id)}
                              disabled={cat.itemCount > 0}
                              title={cat.itemCount > 0 ? 'Move or delete items first' : undefined}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create form */}
        {isCreating && (
          <div className={styles.createForm}>
            <h3 className={styles.createTitle}>New Category</h3>
            <div className={styles.createFields}>
              <input
                type="number"
                className={styles.sortInput}
                placeholder="Sort"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
              />
              <input
                type="text"
                className={styles.nameInput}
                placeholder="slug-name (URL safe)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                type="text"
                className={styles.labelInput}
                placeholder="Display Label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <div className={styles.createActions}>
                <button type="button" className={styles.saveBtn} onClick={handleCreate} disabled={creating}>Create</button>
                <button type="button" className={styles.cancelBtn} onClick={() => { setIsCreating(false); setActionError(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}