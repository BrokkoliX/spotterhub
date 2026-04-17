'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_MANUFACTURERS,
  CREATE_MANUFACTURER,
  DELETE_MANUFACTURER,
  EXPORT_MANUFACTURERS,
  UPDATE_MANUFACTURER,
  UPSERT_MANUFACTURER,
} from '@/lib/queries';
import { downloadCSV, parseCSV } from '@/lib/csv';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

type ManufacturerNode = {
  id: string;
  name: string;
  country: string | null;
  createdAt: string;
};

type ImportRow = {
  name: string;
  country: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

export default function AdminManufacturersPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', country: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_MANUFACTURERS,
    variables: { search: search || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [exportResult, reexecuteExport] = useQuery({
    query: EXPORT_MANUFACTURERS,
    pause: true,
  });

  const [, createManufacturer] = useMutation(CREATE_MANUFACTURER);
  const [, updateManufacturer] = useMutation(UPDATE_MANUFACTURER);
  const [, deleteManufacturer] = useMutation(DELETE_MANUFACTURER);
  const [, upsertManufacturer] = useMutation(UPSERT_MANUFACTURER);

  const manufacturers = data?.aircraftManufacturers;
  const hasNextPage = manufacturers?.pageInfo?.hasNextPage;
  const endCursor = manufacturers?.pageInfo?.endCursor;

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.aircraftManufacturers?.edges?.map((e: { node: ManufacturerNode }) => e.node);
    if (!rows || rows.length === 0) return;
    const csv = toCSVExport(rows);
    downloadCSV(csv, 'manufacturers.csv');
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
        country: get(row, idx('country')).trim(),
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

      const input = { name: row.name, country: row.country || undefined };
      const res = await upsertManufacturer({ input });
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
    setFormData({ name: '', country: '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (node: ManufacturerNode) => {
    setEditingId(node.id);
    setFormData({ name: node.name, country: node.country ?? '' });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const input = {
      name: formData.name.trim(),
      country: formData.country.trim() || undefined,
    };

    if (!input.name) { setFormError('Name is required'); setFormLoading(false); return; }

    const result = editingId
      ? await updateManufacturer({ id: editingId, input })
      : await createManufacturer({ input });

    setFormLoading(false);
    if (result.error) { setFormError(result.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this manufacturer? It will fail if any families reference it.')) return;
    await deleteManufacturer({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const loadMore = () => {
    if (!endCursor) return;
    reexecute({ requestPolicy: 'network-only', variables: { search: search || undefined, first: PAGE_SIZE, after: endCursor } });
  };

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Aircraft Manufacturers</h1>

      <div className={styles.filters}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>+ Add</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>Export CSV</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => fileInputRef.current?.click()}>Import CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        {manufacturers && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {manufacturers.totalCount} manufacturer{manufacturers.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.loading}>Error loading manufacturers</div>}

      {manufacturers && manufacturers.edges.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Country</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manufacturers.edges.map(({ node }: { node: ManufacturerNode }) => (
                <tr key={node.id}>
                  <td>{node.name}</td>
                  <td>{node.country ?? '—'}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => openEdit(node)}>Edit</button>
                    <button className={styles.actionBtnDanger} onClick={() => handleDelete(node.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasNextPage && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={loadMore} disabled={fetching}>Load More</button>
            </div>
          )}
        </>
      )}

      {manufacturers && manufacturers.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No manufacturers found</div>
      )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>{editingId ? 'Edit Manufacturer' : 'Add Manufacturer'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Name *</label>
                <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Boeing" style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Country</label>
                <input className="input" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="United States" style={{ width: '100%' }} />
              </div>
              {formError && <p className="error-text" style={{ marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Manufacturer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Manufacturers</h2>
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
                  <tr><th>Status</th><th>Name</th><th>Country</th></tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.status === 'success' && <span style={{ color: '#34d399' }}>✓</span>}
                        {row.status === 'error' && <span style={{ color: '#f87171' }} title={row.message}>✗</span>}
                        {row.status === 'pending' && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td>{row.name}</td>
                      <td>{row.country || '—'}</td>
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

function toCSVExport(rows: ManufacturerNode[]): string {
  const header = 'name,country';
  const body = rows.map((r) => {
    const esc = (s: string | null | undefined) => {
      const str = s == null ? '' : String(s);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return [esc(r.name), esc(r.country)].join(',');
  });
  return [header, ...body].join('\n');
}
