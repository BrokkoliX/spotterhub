'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_AIRPORTS,
  CREATE_AIRPORT,
  DELETE_AIRPORT,
  EXPORT_AIRPORTS,
  UPSERT_AIRPORT,
  UPDATE_AIRPORT,
} from '@/lib/queries';
import { parseCSV } from '@/lib/csv';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

type AirportNode = {
  id: string;
  icaoCode: string;
  iataCode: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
};

type ImportRow = {
  icaoCode: string;
  iataCode: string;
  name: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

export default function AdminAirportsPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'superuser');

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    icaoCode: '', iataCode: '', name: '', city: '', country: '', latitude: '', longitude: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_AIRPORTS,
    variables: { search: search || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });

  const [exportResult, reexecuteExport] = useQuery({
    query: EXPORT_AIRPORTS,
    pause: true,
  });

  const [, createAirport] = useMutation(CREATE_AIRPORT);
  const [, upsertAirport] = useMutation(UPSERT_AIRPORT);
  const [, updateAirport] = useMutation(UPDATE_AIRPORT);
  const [, deleteAirport] = useMutation(DELETE_AIRPORT);

  const airports = result.data?.adminAirports?.edges ?? [];
  const hasNextPage = result.data?.adminAirports?.pageInfo?.hasNextPage;
  const endCursor = result.data?.adminAirports?.pageInfo?.endCursor;

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.exportAirports;
    if (!rows || rows.length === 0) return;
    const csv = toCSVExport(rows as AirportNode[]);
    downloadCSV(csv, 'airports.csv');
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

      const idx = (h: string) => headers.indexOf(h);
      const get = (row: string[], i: number) => row[i] ?? '';

      const mapped: ImportRow[] = rows.map((row) => ({
        icaoCode: get(row, idx('icaoCode')).trim().toUpperCase(),
        iataCode: get(row, idx('iataCode')).trim().toUpperCase(),
        name: get(row, idx('name')).trim(),
        city: get(row, idx('city')).trim(),
        country: get(row, idx('country')).trim(),
        latitude: get(row, idx('latitude')).trim(),
        longitude: get(row, idx('longitude')).trim(),
        status: 'pending',
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
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        done.push({ ...row, status: 'error' as const, message: 'Invalid coordinates' });
        setImportRows([...done]);
        continue;
      }
      if (!row.icaoCode || !row.name) {
        done.push({ ...row, status: 'error' as const, message: 'Missing required field (icaoCode, name)' });
        setImportRows([...done]);
        continue;
      }

      const input = {
        icaoCode: row.icaoCode,
        iataCode: row.iataCode || undefined,
        name: row.name,
        city: row.city || undefined,
        country: row.country || undefined,
        latitude: lat,
        longitude: lng,
      };

      const res = await upsertAirport({ input });
      const ok = !res.error;
      done.push({ ...row, status: ok ? 'success' as const : 'error' as const, message: ok ? undefined : 'Failed' });
      setImportRows([...done]);
    }

    setImportLoading(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  // ─── CRUD helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setFormData({ icaoCode: '', iataCode: '', name: '', city: '', country: '', latitude: '', longitude: '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (airport: AirportNode) => {
    setEditingId(airport.id);
    setFormData({
      icaoCode: airport.icaoCode,
      iataCode: airport.iataCode ?? '',
      name: airport.name,
      city: airport.city ?? '',
      country: airport.country ?? '',
      latitude: String(airport.latitude),
      longitude: String(airport.longitude),
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
      name: formData.name.trim(),
      city: formData.city.trim() || undefined,
      country: formData.country.trim() || undefined,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
    };

    if (isNaN(input.latitude) || isNaN(input.longitude)) {
      setFormError('Invalid coordinates');
      setFormLoading(false);
      return;
    }

    const res = editingId
      ? await updateAirport({ id: editingId, input })
      : await createAirport({ input });

    setFormLoading(false);
    if (res.error) { setFormError(res.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this airport? It will fail if any photos reference it.')) return;
    await deleteAirport({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const loadMore = () => {
    if (!endCursor) return;
    reexecute({ requestPolicy: 'network-only', variables: { search: search || undefined, first: PAGE_SIZE, after: endCursor } });
  };

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const pendingCount = importRows.filter((r) => r.status === 'pending').length;
  const successCount = importRows.filter((r) => r.status === 'success').length;
  const errorCount = importRows.filter((r) => r.status === 'error').length;

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Airports</h1>

      <div className={styles.filters}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Search by code, name, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>+ Add</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>Export CSV</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => fileInputRef.current?.click()}>Import CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        {result.data?.adminAirports && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {result.data.adminAirports.totalCount} airport{result.data.adminAirports.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {result.fetching && <div className={styles.loading}>Loading…</div>}
      {result.error && <div className={styles.loading}>Error loading airports</div>}

      {airports.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ICAO</th>
                <th>IATA</th>
                <th>Name</th>
                <th>City</th>
                <th>Country</th>
                <th>Lat</th>
                <th>Lng</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {airports.map(({ node: airport }: { node: AirportNode }) => (
                <tr key={airport.id}>
                  <td><strong>{airport.icaoCode}</strong></td>
                  <td>{airport.iataCode ?? '—'}</td>
                  <td>{airport.name}</td>
                  <td>{airport.city ?? '—'}</td>
                  <td>{airport.country ?? '—'}</td>
                  <td>{airport.latitude.toFixed(4)}</td>
                  <td>{airport.longitude.toFixed(4)}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => openEdit(airport)}>Edit</button>
                    <button className={styles.actionBtnDanger} onClick={() => handleDelete(airport.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasNextPage && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={loadMore} disabled={result.fetching}>Load More</button>
            </div>
          )}
        </>
      )}

      {airports.length === 0 && !result.fetching && (
        <div className={styles.loading}>No airports found</div>
      )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>{editingId ? 'Edit Airport' : 'Add Airport'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>ICAO *</label>
                  <input className="input" value={formData.icaoCode} onChange={(e) => setFormData({ ...formData, icaoCode: e.target.value })} required placeholder="EGLL" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>IATA</label>
                  <input className="input" value={formData.iataCode} onChange={(e) => setFormData({ ...formData, iataCode: e.target.value })} placeholder="LHR" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Name *</label>
                <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Heathrow Airport" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>City</label>
                  <input className="input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="London" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Country</label>
                  <input className="input" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="United Kingdom" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Latitude *</label>
                  <input className="input" type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} required placeholder="51.4700" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Longitude *</label>
                  <input className="input" type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} required placeholder="-0.4543" style={{ width: '100%' }} />
                </div>
              </div>
              {formError && <p className="error-text" style={{ marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Airport'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Airports</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {importRows.length} rows parsed. Rows with matching ICAO code will be updated; others will be created.
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
                  <tr>
                    <th>Status</th>
                    <th>ICAO</th>
                    <th>IATA</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>Country</th>
                    <th>Lat</th>
                    <th>Lng</th>
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
                      <td>{row.name}</td>
                      <td>{row.city || '—'}</td>
                      <td>{row.country || '—'}</td>
                      <td>{row.latitude || '—'}</td>
                      <td>{row.longitude || '—'}</td>
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

function toCSVExport(rows: AirportNode[]): string {
  const header = 'icaoCode,iataCode,name,city,country,latitude,longitude';
  const body = rows.map((r) => {
    const esc = (s: string | null) => {
      if (s == null) return '';
      const str = String(s);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return [esc(r.icaoCode), esc(r.iataCode), esc(r.name), esc(r.city), esc(r.country), r.latitude, r.longitude].join(',');
  });
  return [header, ...body].join('\n');
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
