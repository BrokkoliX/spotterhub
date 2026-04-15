'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_AIRCRAFT_TYPES,
  CREATE_AIRCRAFT_TYPE,
  DELETE_AIRCRAFT_TYPE,
  EXPORT_AIRCRAFT_TYPES,
  UPSERT_AIRCRAFT_TYPE,
  UPDATE_AIRCRAFT_TYPE,
} from '@/lib/queries';
import { downloadCSV, parseCSV } from '@/lib/csv';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

// CSV column definitions
const CSV_COLUMNS = [
  { key: 'icaoCode' as const, header: 'icaoCode' },
  { key: 'iataCode' as const, header: 'iataCode' },
  { key: 'vendor' as const, header: 'vendor' },
  { key: 'model' as const, header: 'model' },
  { key: 'category' as const, header: 'category' },
  { key: 'engineType' as const, header: 'engineType' },
  { key: 'engineCount' as const, header: 'engineCount' },
];

type AircraftTypeNode = {
  id: string;
  iataCode: string | null;
  icaoCode: string | null;
  vendor: string;
  model: string;
  category: string | null;
  engineType: string | null;
  engineCount: number | null;
};

type ImportRow = {
  icaoCode: string;
  iataCode: string;
  vendor: string;
  model: string;
  category: string;
  engineType: string;
  engineCount: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

export default function AdminAircraftTypesPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    icaoCode: '', iataCode: '', vendor: '', model: '',
    category: '', engineType: '', engineCount: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_AIRCRAFT_TYPES,
    variables: { search: search || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [exportResult, reexecuteExport] = useQuery({
    query: EXPORT_AIRCRAFT_TYPES,
    pause: true,
  });

  const [, createAircraftType] = useMutation(CREATE_AIRCRAFT_TYPE);
  const [, upsertAircraftType] = useMutation(UPSERT_AIRCRAFT_TYPE);
  const [, updateAircraftType] = useMutation(UPDATE_AIRCRAFT_TYPE);
  const [, deleteAircraftType] = useMutation(DELETE_AIRCRAFT_TYPE);

  const aircraftTypes = data?.adminAircraftTypes;
  const hasNextPage = aircraftTypes?.pageInfo?.hasNextPage;
  const endCursor = aircraftTypes?.pageInfo?.endCursor;

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.exportAircraftTypes;
    if (!rows || rows.length === 0) return;
    const csv = toCSVExport(rows);
    downloadCSV(csv, 'aircraft-types.csv');
    reexecuteExport({ pause: true });
  }, [exportResult.data, reexecuteExport]);

  // ─── Import ────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);

      // Map header indices
      const idx = (h: string) => headers.indexOf(h);
      const get = (row: string[], i: number) => row[i] ?? '';

      const mapped: ImportRow[] = rows.map((row) => ({
        icaoCode: get(row, idx('icaoCode')).trim().toUpperCase(),
        iataCode: get(row, idx('iataCode')).trim().toUpperCase(),
        vendor: get(row, idx('vendor')).trim(),
        model: get(row, idx('model')).trim(),
        category: get(row, idx('category')).trim(),
        engineType: get(row, idx('engineType')).trim(),
        engineCount: get(row, idx('engineCount')).trim(),
        status: 'pending',
      }));

      setImportRows(mapped);
      setShowImport(true);
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const processImport = async () => {
    setImportLoading(true);
    const rows = [...importRows];
    setImportRows(rows);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status !== 'pending') continue;
      if (!row.icaoCode || !row.vendor || !row.model) {
        rows[i] = { ...row, status: 'error', message: 'Missing required field (icaoCode, vendor, model)' };
        setImportRows([...rows]);
        continue;
      }

      const input = {
        icaoCode: row.icaoCode,
        iataCode: row.iataCode || undefined,
        vendor: row.vendor,
        model: row.model,
        category: row.category || undefined,
        engineType: row.engineType || undefined,
        engineCount: row.engineCount ? parseInt(row.engineCount, 10) : undefined,
      };

      const res = await upsertAircraftType({ input });
      const ok = !res.error;
      rows[i] = { ...row, status: ok ? 'success' : 'error', message: ok ? undefined : 'Failed' };
      setImportRows([...rows]);
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
    setFormData({ icaoCode: '', iataCode: '', vendor: '', model: '', category: '', engineType: '', engineCount: '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (node: AircraftTypeNode) => {
    setEditingId(node.id);
    setFormData({
      icaoCode: node.icaoCode ?? '',
      iataCode: node.iataCode ?? '',
      vendor: node.vendor,
      model: node.model,
      category: node.category ?? '',
      engineType: node.engineType ?? '',
      engineCount: node.engineCount != null ? String(node.engineCount) : '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const input = {
      icaoCode: formData.icaoCode.trim().toUpperCase(),
      iataCode: formData.iataCode.trim().toUpperCase() || undefined,
      vendor: formData.vendor.trim(),
      model: formData.model.trim(),
      category: formData.category.trim() || undefined,
      engineType: formData.engineType.trim() || undefined,
      engineCount: formData.engineCount ? parseInt(formData.engineCount, 10) : undefined,
    };

    if (!input.icaoCode) { setFormError('ICAO code is required'); setFormLoading(false); return; }
    if (!input.vendor) { setFormError('Vendor is required'); setFormLoading(false); return; }
    if (!input.model) { setFormError('Model is required'); setFormLoading(false); return; }

    const result = editingId
      ? await updateAircraftType({ id: editingId, input })
      : await createAircraftType({ input });

    setFormLoading(false);
    if (result.error) { setFormError(result.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this aircraft type? It will fail if any aircraft reference it.')) return;
    await deleteAircraftType({ id });
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
      <h1 className={styles.title}>Aircraft Types</h1>

      <div className={styles.filters}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Search by vendor, model, IATA, ICAO…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>
          + Add
        </button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>
          Export CSV
        </button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => fileInputRef.current?.click()}>
          Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {aircraftTypes && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {aircraftTypes.totalCount} type{aircraftTypes.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.loading}>Error loading aircraft types</div>}

      {aircraftTypes && aircraftTypes.edges.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>IATA</th>
                <th>ICAO</th>
                <th>Vendor</th>
                <th>Model</th>
                <th>Category</th>
                <th>Engines</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {aircraftTypes.edges.map(({ node }: { node: AircraftTypeNode }) => (
                <tr key={node.id}>
                  <td>{node.iataCode ?? '—'}</td>
                  <td>{node.icaoCode ?? '—'}</td>
                  <td>{node.vendor}</td>
                  <td>{node.model}</td>
                  <td>{node.category ?? '—'}</td>
                  <td>{node.engineCount ? `${node.engineCount}× ${node.engineType ?? ''}` : '—'}</td>
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

      {aircraftTypes && aircraftTypes.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No aircraft types found</div>
      )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>{editingId ? 'Edit Aircraft Type' : 'Add Aircraft Type'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>ICAO *</label>
                  <input className="input" value={formData.icaoCode} onChange={(e) => setFormData({ ...formData, icaoCode: e.target.value })} required placeholder="B738" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>IATA</label>
                  <input className="input" value={formData.iataCode} onChange={(e) => setFormData({ ...formData, iataCode: e.target.value })} placeholder="738" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Vendor *</label>
                  <input className="input" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} required placeholder="Boeing" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Model *</label>
                  <input className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} required placeholder="737-86N" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Category</label>
                  <input className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Landplane" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Engine Type</label>
                  <input className="input" value={formData.engineType} onChange={(e) => setFormData({ ...formData, engineType: e.target.value })} placeholder="Jet" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Engine Count</label>
                <input className="input" type="number" value={formData.engineCount} onChange={(e) => setFormData({ ...formData, engineCount: e.target.value })} placeholder="2" style={{ width: '100%' }} />
              </div>
              {formError && <p className="error-text" style={{ marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Aircraft Type'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Aircraft Types</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {importRows.length} rows parsed. Rows with matching ICAO code will be updated; others will be created.
            </p>
            {pendingCount > 0 && !importLoading && (
              <div style={{ marginBottom: 16 }}>
                <button className="btn btn-primary" onClick={processImport}>
                  Import {pendingCount} Row{pendingCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}
            {importLoading && (
              <p style={{ marginBottom: 16, color: 'var(--color-text-muted)' }}>Processing…</p>
            )}
            {successCount > 0 && !importLoading && (
              <p style={{ marginBottom: 16, color: '#34d399' }}>{successCount} imported successfully</p>
            )}
            {errorCount > 0 && (
              <p style={{ marginBottom: 16, color: '#f87171' }}>{errorCount} rows failed</p>
            )}
            <div style={{ overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
              <table className={styles.table} style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>ICAO</th>
                    <th>IATA</th>
                    <th>Vendor</th>
                    <th>Model</th>
                    <th>Category</th>
                    <th>Engines</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.status === 'success' && <span style={{ color: '#34d399' }}>✓</span>}
                        {row.status === 'error' && <span style={{ color: '#f87171' }} title={row.message}>✗</span>}
                        {row.status === 'pending' && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td>{row.icaoCode}</td>
                      <td>{row.iataCode || '—'}</td>
                      <td>{row.vendor}</td>
                      <td>{row.model}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.engineCount ? `${row.engineCount}× ${row.engineType}` : '—'}</td>
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

function toCSVExport(rows: AircraftTypeNode[]): string {
  const header = 'icaoCode,iataCode,vendor,model,category,engineType,engineCount';
  const body = rows.map((r) => {
    const esc = (s: string | number | null | undefined) => {
      const str = s == null ? '' : String(s);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return [esc(r.icaoCode), esc(r.iataCode), esc(r.vendor), esc(r.model), esc(r.category), esc(r.engineType), esc(r.engineCount)].join(',');
  });
  return [header, ...body].join('\n');
}
