'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import SearchableSelect from '@/components/SearchableSelect';
import {
  ADMIN_AIRCRAFT,
  ADMIN_AIRLINES,
  ADMIN_FAMILIES,
  ADMIN_MANUFACTURERS,
  ADMIN_VARIANTS,
  CREATE_AIRCRAFT,
  DELETE_AIRCRAFT,
  EXPORT_AIRCRAFT,
  UPDATE_AIRCRAFT,
  UPSERT_AIRCRAFT,
} from '@/lib/queries';
import { downloadCSV, parseCSV } from '@/lib/csv';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

type AircraftNode = {
  id: string;
  registration: string;
  msn: string | null;
  manufacturingDate: string | null;
  operatorType: string | null;
  manufacturer: { id: string; name: string } | null;
  family: { id: string; name: string } | null;
  variant: { id: string; name: string } | null;
  airlineRef: { id: string; name: string; icaoCode: string; iataCode: string } | null;
};

type ImportRow = {
  registration: string;
  msn: string;
  manufacturing_date: string;
  operator_type: string;
  manufacturer_name: string;
  family_name: string;
  variant_name: string;
  airline_name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
};

const OPERATOR_TYPES = [
  { value: 'airline', label: 'Airline' },
  { value: 'general_aviation', label: 'General Aviation' },
  { value: 'military', label: 'Military' },
  { value: 'government', label: 'Government' },
  { value: 'cargo', label: 'Cargo' },
  { value: 'charter', label: 'Charter' },
  { value: 'private', label: 'Private' },
];

export default function AdminAircraftPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    registration: '',
    manufacturerId: '',
    familyId: '',
    variantId: '',
    airlineId: '',
    msn: '',
    manufacturingDate: '',
    operatorType: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_AIRCRAFT,
    variables: { search: search || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [manufacturersResult] = useQuery({
    query: ADMIN_MANUFACTURERS,
    variables: { first: 10000 },
    pause: !isAdmin,
  });

  const [familiesResult] = useQuery({
    query: ADMIN_FAMILIES,
    variables: { first: 10000 },
    pause: !isAdmin,
  });

  const [variantsResult] = useQuery({
    query: ADMIN_VARIANTS,
    variables: { first: 10000 },
    pause: !isAdmin,
  });

  const [airlinesResult] = useQuery({
    query: ADMIN_AIRLINES,
    variables: { first: 10000 },
    pause: !isAdmin,
  });

  const [exportResult, reexecuteExport] = useQuery({
    query: EXPORT_AIRCRAFT,
    pause: true,
  });

  const [, createAircraft] = useMutation(CREATE_AIRCRAFT);
  const [, updateAircraft] = useMutation(UPDATE_AIRCRAFT);
  const [, deleteAircraft] = useMutation(DELETE_AIRCRAFT);
  const [, upsertAircraft] = useMutation(UPSERT_AIRCRAFT);

  const aircrafts = data?.adminAircraft;
  const hasNextPage = aircrafts?.pageInfo?.hasNextPage;
  const endCursor = aircrafts?.pageInfo?.endCursor;

  const allManufacturers = manufacturersResult.data?.aircraftManufacturers?.edges?.map((e: { node: { id: string; name: string } }) => e.node) ?? [];
  const manufacturerNameToId = new Map(allManufacturers.map((m: { id: string; name: string }) => [m.name.toLowerCase(), m.id]));

  const allFamilies = familiesResult.data?.aircraftFamilies?.edges?.map((e: { node: { id: string; name: string; manufacturer: { id: string; name: string } } }) => ({
    ...e.node,
    label: `${e.node.name} (${e.node.manufacturer.name})`,
  })) ?? [];
  const familyNameToId = new Map(allFamilies.map((f: { id: string; name: string }) => [f.name.toLowerCase(), f.id]));

  const allVariants = variantsResult.data?.aircraftVariants?.edges?.map((e: { node: { id: string; name: string; family: { id: string; name: string } } }) => ({
    ...e.node,
    label: `${e.node.name} (${e.node.family.name})`,
  })) ?? [];
  const variantNameToId = new Map(allVariants.map((v: { id: string; name: string }) => [v.name.toLowerCase(), v.id]));

  const allAirlines = airlinesResult.data?.airlines?.edges?.map((e: { node: { id: string; name: string; icaoCode: string; iataCode: string } }) => ({
    ...e.node,
    label: `${e.node.name} (${e.node.icaoCode}${e.node.iataCode ? `/${e.node.iataCode}` : ''})`,
  })) ?? [];
  const airlineNameToId = new Map(allAirlines.map((a: { id: string; name: string }) => [a.name.toLowerCase(), a.id]));

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.adminAircraft?.edges?.map((e: { node: AircraftNode }) => e.node);
    if (!rows || rows.length === 0) return;
    const csv = toCSVExport(rows);
    downloadCSV(csv, 'aircraft.csv');
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
        registration: get(row, idx('registration')).trim().toUpperCase(),
        msn: get(row, idx('msn')).trim(),
        manufacturing_date: get(row, idx('manufacturing_date') !== -1 ? idx('manufacturing_date') : idx('manufacturingDate')).trim(),
        operator_type: get(row, idx('operator_type') !== -1 ? idx('operator_type') : idx('operatorType')).trim(),
        manufacturer_name: get(row, idx('manufacturer_name') !== -1 ? idx('manufacturer_name') : idx('manufacturer')).trim(),
        family_name: get(row, idx('family_name') !== -1 ? idx('family_name') : idx('family')).trim(),
        variant_name: get(row, idx('variant_name') !== -1 ? idx('variant_name') : idx('variant')).trim(),
        airline_name: get(row, idx('airline_name') !== -1 ? idx('airline_name') : idx('airline')).trim(),
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
      if (!row.registration) {
        done.push({ ...row, status: 'error' as const, message: 'Registration is required' });
        setImportRows([...done]);
        continue;
      }

      const manufacturerId = row.manufacturer_name ? (manufacturerNameToId.get(row.manufacturer_name.toLowerCase()) ?? null) : null;
      const familyId = row.family_name ? (familyNameToId.get(row.family_name.toLowerCase()) ?? null) : null;
      const variantId = row.variant_name ? (variantNameToId.get(row.variant_name.toLowerCase()) ?? null) : null;
      const airlineId = row.airline_name ? (airlineNameToId.get(row.airline_name.toLowerCase()) ?? null) : null;

      const input = {
        registration: row.registration,
        msn: row.msn || undefined,
        manufacturingDate: row.manufacturing_date || undefined,
        operatorType: row.operator_type || undefined,
        manufacturerId,
        familyId,
        variantId,
        airlineId,
      };

      const res = await upsertAircraft({ input });
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
    setFormData({
      registration: '',
      manufacturerId: allManufacturers[0]?.id ?? '',
      familyId: '',
      variantId: '',
      airlineId: '',
      msn: '',
      manufacturingDate: '',
      operatorType: '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (node: AircraftNode) => {
    setEditingId(node.id);
    setFormData({
      registration: node.registration,
      manufacturerId: node.manufacturer?.id ?? '',
      familyId: node.family?.id ?? '',
      variantId: node.variant?.id ?? '',
      airlineId: node.airlineRef?.id ?? '',
      msn: node.msn ?? '',
      manufacturingDate: node.manufacturingDate ?? '',
      operatorType: node.operatorType ?? '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    if (!formData.registration.trim()) { setFormError('Registration is required'); setFormLoading(false); return; }

    const input = {
      registration: formData.registration.trim().toUpperCase(),
      ...(formData.manufacturerId && { manufacturerId: formData.manufacturerId }),
      ...(formData.familyId && { familyId: formData.familyId }),
      ...(formData.variantId && { variantId: formData.variantId }),
      ...(formData.airlineId && { airlineId: formData.airlineId }),
      ...(formData.msn && { msn: formData.msn }),
      ...(formData.manufacturingDate && { manufacturingDate: formData.manufacturingDate }),
      ...(formData.operatorType && { operatorType: formData.operatorType.toUpperCase() }),
    };

    const result = editingId
      ? await updateAircraft({ id: editingId, input })
      : await createAircraft({ input });

    setFormLoading(false);
    if (result.error) { setFormError(result.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this aircraft? This may fail if photos reference it.')) return;
    await deleteAircraft({ id });
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
      <h1 className={styles.title}>Aircraft</h1>

      <div className={styles.filters}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Search by registration, manufacturer, family, variant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>+ Add</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>Export CSV</button>
        <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={() => fileInputRef.current?.click()}>Import CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        {aircrafts && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {aircrafts.totalCount} aircraft
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.loading}>Error loading aircraft</div>}

      {aircrafts && aircrafts.edges.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr><th>Registration</th><th>Manufacturer</th><th>Family</th><th>Variant</th><th>Operator Type</th><th>Airline</th><th>MSN</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {aircrafts.edges.map(({ node }: { node: AircraftNode }) => (
                <tr key={node.id}>
                  <td>{node.registration}</td>
                  <td>{node.manufacturer?.name ?? '—'}</td>
                  <td>{node.family?.name ?? '—'}</td>
                  <td>{node.variant?.name ?? '—'}</td>
                  <td>{node.operatorType ?? '—'}</td>
                  <td>{node.airlineRef?.name ?? '—'}</td>
                  <td>{node.msn ?? '—'}</td>
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

      {aircrafts && aircrafts.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No aircraft found</div>
      )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>{editingId ? 'Edit Aircraft' : 'Add Aircraft'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Registration *</label>
                  <input
                    className="input"
                    value={formData.registration}
                    onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                    required
                    placeholder="N12345"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Manufacturer</label>
                  <SearchableSelect
                    options={allManufacturers.map((m: { id: string; name: string }) => ({ id: m.id, label: m.name }))}
                    value={formData.manufacturerId}
                    onChange={(id) => {
                      setFormData({ ...formData, manufacturerId: id, familyId: '', variantId: '' });
                    }}
                    placeholder="Search manufacturer…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Family</label>
                  <SearchableSelect
                    options={allFamilies.map((f: { id: string; label: string }) => ({ id: f.id, label: f.label }))}
                    value={formData.familyId}
                    onChange={(id) => {
                      setFormData({ ...formData, familyId: id, variantId: '' });
                    }}
                    placeholder="Search family…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Variant</label>
                  <SearchableSelect
                    options={allVariants.map((v: { id: string; label: string }) => ({ id: v.id, label: v.label }))}
                    value={formData.variantId}
                    onChange={(id) => setFormData({ ...formData, variantId: id })}
                    placeholder="Search variant…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Operator Type</label>
                  <select
                    className="input"
                    value={formData.operatorType}
                    onChange={(e) => setFormData({ ...formData, operatorType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select operator type…</option>
                    {OPERATOR_TYPES.map((ot) => (
                      <option key={ot.value} value={ot.value}>{ot.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Airline</label>
                  <SearchableSelect
                    options={allAirlines.map((a: { id: string; label: string }) => ({ id: a.id, label: a.label }))}
                    value={formData.airlineId}
                    onChange={(id) => setFormData({ ...formData, airlineId: id })}
                    placeholder="Search airline…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>MSN</label>
                  <input
                    className="input"
                    value={formData.msn}
                    onChange={(e) => setFormData({ ...formData, msn: e.target.value })}
                    placeholder="12345"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Manufacturing Date</label>
                  <input
                    className="input"
                    type="date"
                    value={formData.manufacturingDate}
                    onChange={(e) => setFormData({ ...formData, manufacturingDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              {formError && <p className="error-text" style={{ marginTop: 12, marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving…' : editingId ? 'Save Changes' : 'Add Aircraft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Aircraft</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {importRows.length} rows parsed. Matching registrations will be updated; new registrations will be created.
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
                  <tr><th>Status</th><th>Registration</th><th>Manufacturer</th><th>Family</th><th>Variant</th><th>Operator Type</th><th>Airline</th></tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.status === 'success' && <span style={{ color: '#34d399' }}>✓</span>}
                        {row.status === 'error' && <span style={{ color: '#f87171' }} title={row.message}>✗</span>}
                        {row.status === 'pending' && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td>{row.registration}</td>
                      <td>{row.manufacturer_name || '—'}</td>
                      <td>{row.family_name || '—'}</td>
                      <td>{row.variant_name || '—'}</td>
                      <td>{row.operator_type || '—'}</td>
                      <td>{row.airline_name || '—'}</td>
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

function toCSVExport(rows: AircraftNode[]): string {
  const header = 'registration,msn,manufacturing_date,operator_type,manufacturer_name,family_name,variant_name,airline_name';
  const body = rows.map((r) => {
    const esc = (s: string | null | undefined) => {
      const str = s == null ? '' : String(s);
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    return [
      esc(r.registration),
      esc(r.msn),
      esc(r.manufacturingDate),
      esc(r.operatorType),
      esc(r.manufacturer?.name),
      esc(r.family?.name),
      esc(r.variant?.name),
      esc(r.airlineRef?.name),
    ].join(',');
  });
  return [header, ...body].join('\n');
}
