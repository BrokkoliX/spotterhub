'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_AIRCRAFT_SPECIFIC_CATEGORIES,
  CREATE_AIRCRAFT_SPECIFIC_CATEGORY,
  DELETE_AIRCRAFT_SPECIFIC_CATEGORY,
  UPDATE_AIRCRAFT_SPECIFIC_CATEGORY,
  EXPORT_AIRCRAFT_SPECIFIC_CATEGORIES,
  UPSERT_AIRCRAFT_SPECIFIC_CATEGORY,
} from '@/lib/queries';
import { downloadCSV, parseCSV } from '@/lib/csv';

import styles from '../page.module.css';

type ImportRow = {
  name: string;
  label: string;
  sortOrder: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

type CategoryNode = {
  id: string;
  name: string;
  label: string;
  sortOrder: number;
  createdAt: string;
};

export default function AdminAircraftSpecificCategoriesPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', label: '', sortOrder: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_AIRCRAFT_SPECIFIC_CATEGORIES,
    variables: {},
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [, createCategory] = useMutation(CREATE_AIRCRAFT_SPECIFIC_CATEGORY);
  const [, updateCategory] = useMutation(UPDATE_AIRCRAFT_SPECIFIC_CATEGORY);
  const [, deleteCategory] = useMutation(DELETE_AIRCRAFT_SPECIFIC_CATEGORY);
  const [, upsertCategory] = useMutation(UPSERT_AIRCRAFT_SPECIFIC_CATEGORY);

  const [exportResult, reexecuteExport] = useQuery({
    query: EXPORT_AIRCRAFT_SPECIFIC_CATEGORIES,
    pause: true,
  });

  const categories = data?.aircraftSpecificCategories ?? [];

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.aircraftSpecificCategories;
    if (!rows || rows.length === 0) return;
    const csv = toCSVExport(rows);
    downloadCSV(csv, 'aircraft-specific-categories.csv');
    reexecuteExport({ pause: true });
  }, [exportResult.data, reexecuteExport]);

  // ─── Import ────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows: csvRows } = parseCSV(text);
      const idx = (h: string) => headers.indexOf(h);
      const get = (row: string[], i: number) => row[i] ?? '';
      const mapped: ImportRow[] = csvRows.map((row) => ({
        name: get(row, idx('name')).trim(),
        label: get(row, idx('label')).trim(),
        sortOrder: get(row, idx('sortOrder')).trim(),
        status: 'pending' as const,
      }));
      setImportRows(mapped);
      setShowImport(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processImport = async () => {
    setImportLoading(true);
    const pending = importRows.filter((r) => r.status === 'pending');
    const done = importRows.filter((r) => r.status !== 'pending');

    for (const row of pending) {
      if (!row.name) {
        done.push({ ...row, status: 'error' as const, message: 'Name is required' });
        setImportRows([...done]);
        continue;
      }
      if (!row.label) {
        done.push({ ...row, status: 'error' as const, message: 'Label is required' });
        setImportRows([...done]);
        continue;
      }

      const input = {
        name: row.name.toLowerCase().replace(/\s+/g, '_'),
        label: row.label,
        sortOrder: row.sortOrder ? parseInt(row.sortOrder, 10) : undefined,
      };

      const res = await upsertCategory({ input });
      const ok = !res.error;
      const errorMsg = res.error?.graphQLErrors?.[0]?.message ?? (res.error ? 'Failed' : undefined);
      done.push({ ...row, status: ok ? 'success' as const : 'error' as const, message: errorMsg });
      setImportRows([...done]);
    }

    setImportLoading(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const pendingCount = importRows.filter((r) => r.status === 'pending').length;
  const successCount = importRows.filter((r) => r.status === 'success').length;
  const errorCount = importRows.filter((r) => r.status === 'error').length;

  // ─── CRUD helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', label: '', sortOrder: String(categories.length + 1) });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (node: CategoryNode) => {
    setEditingId(node.id);
    setFormData({ name: node.name, label: node.label, sortOrder: String(node.sortOrder) });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const input = {
      name: formData.name.trim().toLowerCase().replace(/\s+/g, '_'),
      label: formData.label.trim(),
      sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
    };

    if (!input.name) { setFormError('Name is required'); setFormLoading(false); return; }
    if (!input.label) { setFormError('Label is required'); setFormLoading(false); return; }

    const result = editingId
      ? await updateCategory({ id: editingId, input })
      : await createCategory({ input });

    setFormLoading(false);
    if (result.error) { setFormError(result.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await deleteCategory({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Aircraft-Specific Categories</h1>

      <div className={styles.filters}>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>+ Add</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>Export CSV</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => fileInputRef.current?.click()}>Import CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {categories.length} category{categories.length !== 1 ? 'ries' : ''}
        </span>
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.loading}>Error loading categories</div>}

      {categories.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Label</th>
              <th>Sort Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...categories].sort((a: CategoryNode, b: CategoryNode) => a.sortOrder - b.sortOrder).map((node: CategoryNode) => (
              <tr key={node.id}>
                <td><code style={{ fontSize: '0.8125rem' }}>{node.name}</code></td>
                <td>{node.label}</td>
                <td>{node.sortOrder}</td>
                <td>
                  <button className={styles.actionBtn} onClick={() => openEdit(node)}>Edit</button>
                  <button className={styles.actionBtnDanger} onClick={() => handleDelete(node.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {categories.length === 0 && !fetching && (
        <div className={styles.loading}>No categories found</div>
      )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>{editingId ? 'Edit Category' : 'Add Category'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Name *</label>
                  <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="narrowbody" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Label *</label>
                  <input className="input" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} required placeholder="Narrowbody" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Sort Order</label>
                <input className="input" type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })} placeholder="1" style={{ width: '100%' }} />
              </div>
              {formError && <p className="error-text" style={{ marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Aircraft Specific Categories</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {importRows.length} rows parsed. Matching names will be updated; new names will be created.
            </p>
            {pendingCount > 0 && !importLoading && (
              <div style={{ marginBottom: 16 }}>
                <button className="btn btn-primary" onClick={processImport}>Import {pendingCount} Row{pendingCount !== 1 ? 's' : ''}</button>
              </div>
            )}
            {importLoading && <p style={{ marginBottom: 16, color: 'var(--color-text-muted)' }}>Processing…</p>}
            {successCount > 0 && !importLoading && <p style={{ marginBottom: 16, color: '#34d399' }}>{successCount} imported successfully</p>}
            {errorCount > 0 && <p style={{ marginBottom: 16, color: '#f87171' }}>{errorCount} rows failed</p>}
            <div style={{ overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
              <table className={styles.table} style={{ margin: 0 }}>
                <thead>
                  <tr><th>Status</th><th>Name</th><th>Label</th><th>Sort Order</th></tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.status === 'success' && <span style={{ color: '#34d399' }}>✓</span>}
                        {row.status === 'error' && <span style={{ color: '#f87171' }} title={row.message}>✗</span>}
                        {row.status === 'pending' && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td><code>{row.name}</code></td>
                      <td>{row.label}</td>
                      <td>{row.sortOrder || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowImport(false); setImportRows([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toCSVExport(rows: CategoryNode[]): string {
  const header = 'name,label,sortOrder';
  const body = rows.map((r) => {
    const esc = (s: string | number | null | undefined) => {
      const str = s == null ? '' : String(s);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return [esc(r.name), esc(r.label), esc(r.sortOrder)].join(',');
  });
  return [header, ...body].join('\n');
}
