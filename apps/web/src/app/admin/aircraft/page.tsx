'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import AddAircraftModal, { type AddAircraftFormValues } from '@/components/AddAircraftModal';
import {
  ADMIN_AIRCRAFT,
  ADMIN_AIRLINES,
  ADMIN_FAMILIES,
  ADMIN_MANUFACTURERS,
  ADMIN_VARIANTS,
  APPROVE_AIRCRAFT,
  CREATE_AIRCRAFT,
  DELETE_AIRCRAFT,
  EXPORT_AIRCRAFT,
  REJECT_AIRCRAFT,
  UPDATE_AIRCRAFT,
  UPSERT_AIRCRAFT,
} from '@/lib/queries';
import { downloadCSV, parseCSV } from '@/lib/csv';
import { Pagination } from '@/components/Pagination';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

type AircraftNode = {
  id: string;
  registration: string;
  msn: string | null;
  manufacturingDate: string | null;
  operatorType: string | null;
  status: string;
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

export default function AdminAircraftPage() {
  const { user, ready } = useAuth();
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAircraft, setEditingAircraft] = useState<AddAircraftFormValues | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, reexecute] = useQuery({
    query: ADMIN_AIRCRAFT,
    variables: { search: search || undefined, first: PAGE_SIZE, page: currentPage },
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
  const [, approveAircraft] = useMutation(APPROVE_AIRCRAFT);
  const [, rejectAircraft] = useMutation(REJECT_AIRCRAFT);

  const aircrafts = data?.adminAircraft;
  const filteredAircrafts = statusFilter
    ? {
        ...aircrafts,
        edges:
          aircrafts?.edges?.filter(
            ({ node }: { node: AircraftNode }) => node.status === statusFilter,
          ) ?? [],
        totalCount:
          aircrafts?.edges?.filter(
            ({ node }: { node: AircraftNode }) => node.status === statusFilter,
          ).length ?? 0,
      }
    : aircrafts;
  const totalCount = filteredAircrafts?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const allManufacturers =
    manufacturersResult.data?.aircraftManufacturers?.edges?.map(
      (e: { node: { id: string; name: string } }) => e.node,
    ) ?? [];
  const manufacturerNameToId = new Map(
    allManufacturers.map((m: { id: string; name: string }) => [m.name.toLowerCase(), m.id]),
  );

  const allFamilies =
    familiesResult.data?.aircraftFamilies?.edges?.map(
      (e: { node: { id: string; name: string; manufacturer: { id: string; name: string } } }) => ({
        ...e.node,
        label: `${e.node.name} (${e.node.manufacturer.name})`,
      }),
    ) ?? [];
  // Family name is unique per manufacturer (not globally), so keying by name
  // alone is ambiguous. Key by (manufacturer name, family name) for the
  // aircraft CSV import flow.
  const familyNameToId = new Map(
    allFamilies.map((f: { id: string; name: string; manufacturer: { name: string } }) => [
      `${f.manufacturer.name.toLowerCase()}|${f.name.toLowerCase()}`,
      f.id,
    ]),
  );

  const allVariants =
    variantsResult.data?.aircraftVariants?.edges?.map(
      (e: { node: { id: string; name: string; family: { id: string; name: string } } }) => ({
        ...e.node,
        label: `${e.node.name} (${e.node.family.name})`,
      }),
    ) ?? [];
  const variantNameToId = new Map(
    allVariants.map((v: { id: string; name: string }) => [v.name.toLowerCase(), v.id]),
  );

  const allAirlines =
    airlinesResult.data?.airlines?.edges?.map(
      (e: { node: { id: string; name: string; icaoCode: string; iataCode: string } }) => ({
        ...e.node,
        label: `${e.node.name} (${e.node.icaoCode}${e.node.iataCode ? `/${e.node.iataCode}` : ''})`,
      }),
    ) ?? [];
  const airlineNameToId = new Map(
    allAirlines.map((a: { id: string; name: string }) => [a.name.toLowerCase(), a.id]),
  );

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    reexecuteExport({ requestPolicy: 'network-only' });
  }, [reexecuteExport]);

  useEffect(() => {
    const rows = exportResult.data?.adminAircraft?.edges?.map(
      (e: { node: AircraftNode }) => e.node,
    );
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
        manufacturing_date: get(
          row,
          idx('manufacturing_date') !== -1 ? idx('manufacturing_date') : idx('manufacturingDate'),
        ).trim(),
        operator_type: get(
          row,
          idx('operator_type') !== -1 ? idx('operator_type') : idx('operatorType'),
        ).trim(),
        manufacturer_name: get(
          row,
          idx('manufacturer_name') !== -1 ? idx('manufacturer_name') : idx('manufacturer'),
        ).trim(),
        family_name: get(
          row,
          idx('family_name') !== -1 ? idx('family_name') : idx('family'),
        ).trim(),
        variant_name: get(
          row,
          idx('variant_name') !== -1 ? idx('variant_name') : idx('variant'),
        ).trim(),
        airline_name: get(
          row,
          idx('airline_name') !== -1 ? idx('airline_name') : idx('airline'),
        ).trim(),
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

      const manufacturerId = row.manufacturer_name
        ? (manufacturerNameToId.get(row.manufacturer_name.toLowerCase()) ?? null)
        : null;
      // Family name is unique per manufacturer — key by both to disambiguate.
      // If the row has a family name but no manufacturer, the lookup is
      // ambiguous (multiple families can share a name), so we skip family
      // resolution and rely on the user to fix the CSV.
      const familyId =
        row.family_name && row.manufacturer_name
          ? (familyNameToId.get(
              `${row.manufacturer_name.toLowerCase()}|${row.family_name.toLowerCase()}`,
            ) ?? null)
          : null;
      const variantId = row.variant_name
        ? (variantNameToId.get(row.variant_name.toLowerCase()) ?? null)
        : null;
      const airlineId = row.airline_name
        ? (airlineNameToId.get(row.airline_name.toLowerCase()) ?? null)
        : null;

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
      done.push({
        ...row,
        status: ok ? ('success' as const) : ('error' as const),
        message: errorMsg,
      });
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
    setEditingAircraft(null);
    setShowForm(true);
  };

  const openEdit = (node: AircraftNode) => {
    setEditingId(node.id);
    setEditingAircraft({
      registration: node.registration,
      manufacturerId: node.manufacturer?.id ?? '',
      familyId: node.family?.id ?? '',
      variantId: node.variant?.id ?? '',
      airlineId: node.airlineRef?.id ?? '',
      msn: node.msn ?? '',
      manufacturingDate: node.manufacturingDate ?? '',
      operatorType: node.operatorType ?? '',
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingAircraft(null);
  };

  const handleSubmitForm = async (values: AddAircraftFormValues) => {
    const input = {
      registration: values.registration,
      ...(values.manufacturerId && { manufacturerId: values.manufacturerId }),
      ...(values.familyId && { familyId: values.familyId }),
      ...(values.variantId && { variantId: values.variantId }),
      ...(values.airlineId && { airlineId: values.airlineId }),
      ...(values.msn && { msn: values.msn }),
      ...(values.manufacturingDate && { manufacturingDate: values.manufacturingDate }),
      ...(values.operatorType && { operatorType: values.operatorType }),
    };

    const result = editingId
      ? await updateAircraft({ id: editingId, input })
      : await createAircraft({ input });

    if (result.error) {
      return { ok: false as const, error: result.error.graphQLErrors[0]?.message ?? 'Failed' };
    }

    const newId = editingId ?? result.data?.createAircraft?.id ?? '';
    handleCloseForm();
    reexecute({ requestPolicy: 'network-only' });
    return { ok: true as const, aircraft: { id: newId, registration: values.registration } };
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this aircraft? This may fail if photos reference it.')) return;
    await deleteAircraft({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this aircraft? It will become active and photos may be linked.')) return;
    await approveAircraft({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this aircraft? It will be permanently deleted.')) return;
    await rejectAircraft({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    reexecute({
      requestPolicy: 'network-only',
      variables: {
        search: search || undefined,
        status: statusFilter || undefined,
        first: PAGE_SIZE,
        page,
      },
    });
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
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            className={styles.filterInput}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
          </select>
          <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={openCreate}>
            + Add
          </button>
          <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExport}>
            Export CSV
          </button>
          <button
            className={`btn btn-secondary ${styles.actionBtn}`}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {aircrafts && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {filteredAircrafts?.totalCount ?? 0} aircraft
              {statusFilter && ` (filtered from ${aircrafts.totalCount})`}
            </span>
          )}
        </div>

        {/* Pending Approval Banner */}
        {!statusFilter &&
          aircrafts?.edges?.some(
            ({ node }: { node: AircraftNode }) => node.status === 'PENDING_APPROVAL',
          ) && (
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 500 }}>
                ⚠{' '}
                {
                  aircrafts.edges.filter(
                    ({ node }: { node: AircraftNode }) => node.status === 'PENDING_APPROVAL',
                  ).length
                }{' '}
                aircraft pending approval
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setStatusFilter('pending_approval')}
              >
                Show Pending
              </button>
            </div>
          )}

        {fetching && <div className={styles.loading}>Loading…</div>}
        {error && <div className={styles.loading}>Error loading aircraft</div>}

        {filteredAircrafts && filteredAircrafts.edges.length > 0 && (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Status</th>
                  <th>Manufacturer</th>
                  <th>Family</th>
                  <th>Variant</th>
                  <th>Operator Type</th>
                  <th>Airline</th>
                  <th>MSN</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAircrafts.edges.map(({ node }: { node: AircraftNode }) => (
                  <tr
                    key={node.id}
                    style={
                      node.status === 'PENDING_APPROVAL'
                        ? { background: 'rgba(251, 191, 147, 0.1)' }
                        : {}
                    }
                  >
                    <td style={{ fontWeight: node.status === 'PENDING_APPROVAL' ? 600 : 400 }}>
                      {node.registration}
                      {node.status === 'PENDING_APPROVAL' && (
                        <span style={{ marginLeft: 6, color: '#f59e0b', fontSize: '0.75rem' }}>
                          ⏳ pending
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background:
                            node.status === 'PENDING_APPROVAL'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(34, 197, 94, 0.2)',
                          color: node.status === 'PENDING_APPROVAL' ? '#f59e0b' : '#22c55e',
                        }}
                      >
                        {node.status === 'PENDING_APPROVAL' ? 'Pending' : 'Active'}
                      </span>
                    </td>
                    <td>{node.manufacturer?.name ?? '—'}</td>
                    <td>{node.family?.name ?? '—'}</td>
                    <td>{node.variant?.name ?? '—'}</td>
                    <td>{node.operatorType ?? '—'}</td>
                    <td>{node.airlineRef?.name ?? '—'}</td>
                    <td>{node.msn ?? '—'}</td>
                    <td>
                      {node.status === 'PENDING_APPROVAL' ? (
                        <>
                          <button
                            className={styles.actionBtn}
                            style={{ color: '#22c55e' }}
                            onClick={() => handleApprove(node.id)}
                          >
                            Approve
                          </button>
                          <button
                            className={styles.actionBtnDanger}
                            onClick={() => handleReject(node.id)}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button className={styles.actionBtn} onClick={() => openEdit(node)}>
                            Edit
                          </button>
                          <button
                            className={styles.actionBtnDanger}
                            onClick={() => handleDelete(node.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                loading={fetching}
              />
            )}
          </>
        )}

        {filteredAircrafts && filteredAircrafts.edges.length === 0 && !fetching && (
          <div className={styles.loading}>
            {statusFilter ? 'No aircraft match the selected filter' : 'No aircraft found'}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AddAircraftModal
        key={editingId ?? 'new'}
        open={showForm}
        initialData={
          editingAircraft ? { ...editingAircraft, id: editingId ?? undefined } : undefined
        }
        manufacturers={allManufacturers}
        families={allFamilies}
        variants={allVariants}
        familyPlaceholder="Search family…"
        variantPlaceholder="Search variant…"
        airlines={allAirlines}
        onSubmit={handleSubmitForm}
        onClose={handleCloseForm}
      />

      {/* Import Preview Modal */}
      {showImport && (
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
              maxWidth: 900,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <h2 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Import Aircraft</h2>
            <p
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}
            >
              {importRows.length} rows parsed. Matching registrations will be updated; new
              registrations will be created.
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
              <p style={{ marginBottom: 16, color: '#34d399' }}>
                {successCount} imported successfully
              </p>
            )}
            {errorCount > 0 && (
              <p style={{ marginBottom: 16, color: '#f87171' }}>{errorCount} rows failed</p>
            )}
            <div
              style={{
                overflow: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <table className={styles.table} style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Registration</th>
                    <th>Manufacturer</th>
                    <th>Family</th>
                    <th>Variant</th>
                    <th>Operator Type</th>
                    <th>Airline</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.status === 'success' && <span style={{ color: '#34d399' }}>✓</span>}
                        {row.status === 'error' && (
                          <span style={{ color: '#f87171' }} title={row.message}>
                            ✗
                          </span>
                        )}
                        {row.status === 'pending' && (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
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
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowImport(false);
                  setImportRows([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toCSVExport(rows: AircraftNode[]): string {
  const header =
    'registration,msn,manufacturing_date,operator_type,manufacturer_name,family_name,variant_name,airline_name';
  const body = rows.map((r) => {
    const esc = (s: string | null | undefined) => {
      const str = s == null ? '' : String(s);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
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
