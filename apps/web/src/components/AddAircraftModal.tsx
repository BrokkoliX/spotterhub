'use client';

import { type FormEvent, useState } from 'react';
import { useQuery } from 'urql';

import SearchableSelect from '@/components/SearchableSelect';
import { GET_AIRCRAFT_FAMILIES, GET_AIRCRAFT_VARIANTS } from '@/lib/queries';

export type AddAircraftFormValues = {
  registration: string;
  manufacturerId: string;
  familyId: string;
  variantId: string;
  operatorType: string;
  msn: string;
  manufacturingDate: string;
  airlineId: string;
};

export type AddAircraftSubmitResult =
  | { ok: true; aircraft: { id: string; registration: string } }
  | { ok: false; error: string };

export const OPERATOR_TYPES = [
  { value: 'AIRLINE', label: 'Airline' },
  { value: 'GENERAL_AVIATION', label: 'General Aviation' },
  { value: 'MILITARY', label: 'Military' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'CARGO', label: 'Cargo' },
  { value: 'CHARTER', label: 'Charter' },
  { value: 'PRIVATE', label: 'Private' },
];

export interface AddAircraftModalProps {
  open: boolean;
  /** Defaults to "Edit Aircraft" when initialData.id is set, else "Add Aircraft". */
  title?: string;
  /** Defaults to "Save Changes" / "Add Aircraft" based on edit mode. */
  submitLabel?: string;
  /** Pre-fill values. Pass `id` to enter edit mode. */
  initialData?: Partial<AddAircraftFormValues> & { id?: string };
  /** When true, the registration field is disabled (used by upload with pre-filled value). */
  lockRegistration?: boolean;

  /** Aircraft hierarchy data. If `families`/`variants` are not provided, the component fetches them via cascaded server-side queries. */
  manufacturers: Array<{ id: string; name: string }>;
  families?: Array<{ id: string; name: string; manufacturer: { id: string; name: string } }>;
  variants?: Array<{ id: string; name: string; family: { id: string; name: string } }>;
  familiesLoading?: boolean;
  variantsLoading?: boolean;
  familyPlaceholder?: string;
  variantPlaceholder?: string;
  airlines: Array<{ id: string; name: string; icaoCode: string; iataCode: string | null }>;

  /** Parent picks the mutation (createAircraft / updateAircraft / createPendingAircraft). */
  onSubmit: (values: AddAircraftFormValues) => Promise<AddAircraftSubmitResult>;
  /** Fires after a successful submit. `display` is populated only in cascaded mode (upload) with the resolved family/variant names so the parent can update its own name state. */
  onSuccess?: (
    aircraft: { id: string; registration: string },
    values: AddAircraftFormValues,
    display?: { familyName?: string; variantName?: string },
  ) => void;
  onClose: () => void;
}

const OPTIONAL_LABEL = (
  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
);
const REQUIRED_MARK = <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>;

export default function AddAircraftModal({
  open,
  title,
  submitLabel,
  initialData,
  lockRegistration = false,
  manufacturers,
  families: familiesProp,
  variants: variantsProp,
  familiesLoading: familiesLoadingProp,
  variantsLoading: variantsLoadingProp,
  familyPlaceholder,
  variantPlaceholder,
  airlines,
  onSubmit,
  onSuccess,
  onClose,
}: AddAircraftModalProps) {
  const [registration, setRegistration] = useState(initialData?.registration ?? '');
  const [manufacturerId, setManufacturerId] = useState(initialData?.manufacturerId ?? '');
  const [familyId, setFamilyId] = useState(initialData?.familyId ?? '');
  const [variantId, setVariantId] = useState(initialData?.variantId ?? '');
  const [operatorType, setOperatorType] = useState(initialData?.operatorType ?? '');
  const [msn, setMsn] = useState(initialData?.msn ?? '');
  const [manufacturingDate, setManufacturingDate] = useState(initialData?.manufacturingDate ?? '');
  const [airlineId, setAirlineId] = useState(initialData?.airlineId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cascaded queries — only fetched when the parent hasn't supplied pre-loaded lists
  // and the upstream dropdown is selected.
  const [familiesResult] = useQuery({
    query: GET_AIRCRAFT_FAMILIES,
    variables: { manufacturerId, first: 1000 },
    pause: familiesProp !== undefined || !manufacturerId,
    requestPolicy: 'cache-and-network',
  });
  const cascadedFamilies =
    familiesProp === undefined && manufacturerId
      ? (familiesResult.data?.aircraftFamilies?.edges?.map(
          (e: {
            node: { id: string; name: string; manufacturer: { id: string; name: string } };
          }) => ({
            ...e.node,
            label: `${e.node.name} (${e.node.manufacturer.name})`,
          }),
        ) ?? [])
      : [];

  const [variantsResult] = useQuery({
    query: GET_AIRCRAFT_VARIANTS,
    variables: { familyId, first: 1000 },
    pause: variantsProp !== undefined || !familyId,
    requestPolicy: 'cache-and-network',
  });
  const cascadedVariants =
    variantsProp === undefined && familyId
      ? (variantsResult.data?.aircraftVariants?.edges?.map(
          (e: { node: { id: string; name: string; family: { id: string; name: string } } }) => ({
            ...e.node,
            label: `${e.node.name} (${e.node.family.name})`,
          }),
        ) ?? [])
      : [];

  const families = familiesProp ?? cascadedFamilies;
  const variants = variantsProp ?? cascadedVariants;
  const familiesLoading =
    familiesLoadingProp ?? (familiesProp === undefined && familiesResult.fetching);
  const variantsLoading =
    variantsLoadingProp ?? (variantsProp === undefined && variantsResult.fetching);

  if (!open) return null;

  const isEdit = !!initialData?.id;
  const resolvedTitle = title ?? (isEdit ? 'Edit Aircraft' : 'Add Aircraft');
  const resolvedSubmitLabel = submitLabel ?? (isEdit ? 'Save Changes' : 'Add Aircraft');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedReg = registration.trim();
    if (!trimmedReg) {
      setError('Registration is required');
      return;
    }
    if (!manufacturerId || !familyId || !variantId) {
      setError('Manufacturer, Family, and Variant are required');
      return;
    }
    if (!operatorType) {
      setError('Operator Type is required');
      return;
    }
    if (!airlineId) {
      setError('Airline is required');
      return;
    }

    setSubmitting(true);
    const values: AddAircraftFormValues = {
      registration: trimmedReg,
      manufacturerId,
      familyId,
      variantId,
      operatorType,
      msn,
      manufacturingDate,
      airlineId,
    };
    const result = await onSubmit(values);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    const familyObj = families.find((f: { id: string }) => f.id === familyId);
    const variantObj = variants.find((v: { id: string }) => v.id === variantId);
    onSuccess?.(result.aircraft, values, {
      familyName: familyObj?.name,
      variantName: variantObj?.name,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{resolvedTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              color: 'var(--color-text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Registration {REQUIRED_MARK}
              </label>
              <input
                className="input"
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                disabled={lockRegistration}
                required
                placeholder="N12345"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Manufacturer {REQUIRED_MARK}
              </label>
              <SearchableSelect
                options={manufacturers.map((m) => ({ id: m.id, label: m.name }))}
                value={manufacturerId}
                onChange={(id) => {
                  setManufacturerId(id);
                  setFamilyId('');
                  setVariantId('');
                }}
                placeholder="Search manufacturer…"
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Family {REQUIRED_MARK}
              </label>
              <SearchableSelect
                options={families.map(
                  (f: { id: string; name: string; manufacturer: { name: string } }) => ({
                    id: f.id,
                    label: `${f.name} (${f.manufacturer.name})`,
                  }),
                )}
                value={familyId}
                onChange={(id) => {
                  setFamilyId(id);
                  setVariantId('');
                }}
                placeholder={
                  familyPlaceholder ?? (manufacturerId ? 'Search…' : 'Select manufacturer first')
                }
                isLoading={familiesLoading}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Variant {REQUIRED_MARK}
              </label>
              <SearchableSelect
                options={variants.map(
                  (v: { id: string; name: string; family: { name: string } }) => ({
                    id: v.id,
                    label: `${v.name} (${v.family.name})`,
                  }),
                )}
                value={variantId}
                onChange={(id) => setVariantId(id)}
                placeholder={variantPlaceholder ?? (familyId ? 'Search…' : 'Select family first')}
                isLoading={variantsLoading}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Operator Type {REQUIRED_MARK}
              </label>
              <select
                className="input"
                value={operatorType}
                onChange={(e) => setOperatorType(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">Select operator type…</option>
                {OPERATOR_TYPES.map((ot) => (
                  <option key={ot.value} value={ot.value}>
                    {ot.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Airline {REQUIRED_MARK}
              </label>
              <SearchableSelect
                options={airlines.map((a) => ({
                  id: a.id,
                  label: `${a.name} (${a.icaoCode}${a.iataCode ? `/${a.iataCode}` : ''})`,
                }))}
                value={airlineId}
                onChange={(id) => setAirlineId(id)}
                placeholder="Search airline…"
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                MSN {OPTIONAL_LABEL}
              </label>
              <input
                className="input"
                value={msn}
                onChange={(e) => setMsn(e.target.value)}
                placeholder="12345"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>
                Manufacturing Date {OPTIONAL_LABEL}
              </label>
              <input
                className="input"
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: 12 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : resolvedSubmitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
