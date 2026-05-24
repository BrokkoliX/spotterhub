'use client';

import { type FormEvent, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADMIN_TIERS, CREATE_TIER, DELETE_TIER, UPDATE_TIER } from '@/lib/queries';
import {
  type AdminTiersQuery,
  type CreateTierInput,
  type UpdateTierInput,
} from '@/lib/generated/graphql';

import styles from '../page.module.css';
import tierStyles from './page.module.css';

type TierRow = AdminTiersQuery['adminTiers'][number];

interface TierFormState {
  slug: string;
  name: string;
  priceCents: string;
  currency: string;
  uploadsPerDay: string;
  uploadsPerWeek: string;
  canCreateCommunity: boolean;
  displayOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: TierFormState = {
  slug: '',
  name: '',
  priceCents: '0',
  currency: 'USD',
  uploadsPerDay: '',
  uploadsPerWeek: '',
  canCreateCommunity: false,
  displayOrder: '0',
  isActive: true,
};

function tierToFormState(t: TierRow): TierFormState {
  return {
    slug: t.slug,
    name: t.name,
    priceCents: String(t.priceCents),
    currency: t.currency,
    uploadsPerDay: t.uploadsPerDay == null ? '' : String(t.uploadsPerDay),
    uploadsPerWeek: t.uploadsPerWeek == null ? '' : String(t.uploadsPerWeek),
    canCreateCommunity: t.canCreateCommunity,
    displayOrder: String(t.displayOrder),
    isActive: t.isActive,
  };
}

function parseInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number.parseInt(value, 10);
}

function parseOptionalInteger(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return parseInteger(trimmed, label);
}

function formToCreateInput(form: TierFormState): CreateTierInput {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    priceCents: parseInteger(form.priceCents, 'Price'),
    currency: form.currency.trim().toUpperCase(),
    uploadsPerDay: parseOptionalInteger(form.uploadsPerDay, 'Uploads per day'),
    uploadsPerWeek: parseOptionalInteger(form.uploadsPerWeek, 'Uploads per week'),
    canCreateCommunity: form.canCreateCommunity,
    displayOrder: parseInteger(form.displayOrder, 'Display order'),
    isActive: form.isActive,
  };
}

function formToUpdateInput(form: TierFormState): UpdateTierInput {
  return {
    name: form.name.trim(),
    priceCents: parseInteger(form.priceCents, 'Price'),
    currency: form.currency.trim().toUpperCase(),
    uploadsPerDay: parseOptionalInteger(form.uploadsPerDay, 'Uploads per day'),
    uploadsPerWeek: parseOptionalInteger(form.uploadsPerWeek, 'Uploads per week'),
    canCreateCommunity: form.canCreateCommunity,
    displayOrder: parseInteger(form.displayOrder, 'Display order'),
    isActive: form.isActive,
  };
}

export default function AdminTiersPage() {
  const { user, ready } = useAuth();
  const isSuperuser = user?.role === 'superuser';

  const [{ data, fetching, error }, reexecute] = useQuery<AdminTiersQuery>({
    query: ADMIN_TIERS,
    pause: !isSuperuser,
  });

  const [, createTier] = useMutation(CREATE_TIER);
  const [, updateTier] = useMutation(UPDATE_TIER);
  const [, deleteTier] = useMutation(DELETE_TIER);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isSuperuser) {
    return <div className={styles.denied}>Access denied — superuser only</div>;
  }

  const tiers = data?.adminTiers ?? [];

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const startEdit = (tier: TierRow) => {
    setEditingId(tier.id);
    setForm(tierToFormState(tier));
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormBusy(true);
    try {
      if (editingId === null) {
        const input = formToCreateInput(form);
        const res = await createTier({ input });
        if (res.error) throw new Error(res.error.message);
      } else {
        const input = formToUpdateInput(form);
        const res = await updateTier({ id: editingId, input });
        if (res.error) throw new Error(res.error.message);
      }
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (tier: TierRow) => {
    if (
      !window.confirm(
        `Delete tier '${tier.name}'? This cannot be undone. Users currently on this tier will block deletion.`,
      )
    ) {
      return;
    }
    const res = await deleteTier({ id: tier.id });
    if (res.error) {
      window.alert(`Delete failed: ${res.error.message}`);
      return;
    }
    refresh();
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={tierStyles.header}>
          <h1 className={styles.title}>Tiers</h1>
          <button type="button" className={tierStyles.primaryBtn} onClick={startCreate}>
            New tier
          </button>
        </div>

        <p className={tierStyles.lede}>
          Tiers control per-user upload caps and community-creation permissions. Every user falls
          back to the <code>free</code> tier when no explicit assignment exists, so deleting{' '}
          <code>free</code> is blocked.
        </p>

        {error && <div className={tierStyles.error}>Failed to load tiers: {error.message}</div>}

        {fetching && <div className={styles.loading}>Loading…</div>}

        {!fetching && tiers.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Slug</th>
                <th>Name</th>
                <th>Price</th>
                <th>Uploads / day</th>
                <th>Uploads / week</th>
                <th>Communities</th>
                <th>Order</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <code>{t.slug}</code>
                  </td>
                  <td>{t.name}</td>
                  <td>
                    {t.priceCents === 0
                      ? 'Free'
                      : `${(t.priceCents / 100).toFixed(2)} ${t.currency}`}
                  </td>
                  <td>{t.uploadsPerDay ?? '∞'}</td>
                  <td>{t.uploadsPerWeek ?? '∞'}</td>
                  <td>{t.canCreateCommunity ? 'Yes' : 'No'}</td>
                  <td>{t.displayOrder}</td>
                  <td>{t.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button type="button" className={styles.actionBtn} onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnDanger}
                      onClick={() => handleDelete(t)}
                      disabled={t.slug === 'free'}
                      title={
                        t.slug === 'free' ? "The 'free' tier cannot be deleted" : 'Delete tier'
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!fetching && tiers.length === 0 && (
          <div className={styles.loading}>No tiers yet — create one to get started.</div>
        )}

        {showForm && (
          <div
            className={tierStyles.formBackdrop}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeForm();
            }}
          >
            <form className={tierStyles.form} onSubmit={handleSubmit}>
              <h2 className={tierStyles.formTitle}>
                {editingId === null ? 'New tier' : `Edit ${form.name || 'tier'}`}
              </h2>

              {formError && <div className={tierStyles.error}>{formError}</div>}

              <label className={tierStyles.field}>
                <span>Slug</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  disabled={editingId !== null}
                  placeholder="e.g. premium"
                />
                {editingId !== null && (
                  <small className={tierStyles.hint}>Slugs are immutable after creation.</small>
                )}
              </label>

              <label className={tierStyles.field}>
                <span>Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>

              <div className={tierStyles.row}>
                <label className={tierStyles.field}>
                  <span>Price (cents)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.priceCents}
                    onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                    required
                  />
                </label>
                <label className={tierStyles.field}>
                  <span>Currency</span>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className={tierStyles.row}>
                <label className={tierStyles.field}>
                  <span>Uploads / day</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.uploadsPerDay}
                    onChange={(e) => setForm({ ...form, uploadsPerDay: e.target.value })}
                    placeholder="Unlimited"
                  />
                </label>
                <label className={tierStyles.field}>
                  <span>Uploads / week</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.uploadsPerWeek}
                    onChange={(e) => setForm({ ...form, uploadsPerWeek: e.target.value })}
                    placeholder="Unlimited"
                  />
                </label>
              </div>

              <label className={tierStyles.field}>
                <span>Display order</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                  required
                />
              </label>

              <label className={tierStyles.checkboxField}>
                <input
                  type="checkbox"
                  checked={form.canCreateCommunity}
                  onChange={(e) => setForm({ ...form, canCreateCommunity: e.target.checked })}
                />
                <span>Can create communities</span>
              </label>

              <label className={tierStyles.checkboxField}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>Active (visible in public tier list)</span>
              </label>

              <div className={tierStyles.formActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={closeForm}
                  disabled={formBusy}
                >
                  Cancel
                </button>
                <button type="submit" className={tierStyles.primaryBtn} disabled={formBusy}>
                  {formBusy ? 'Saving…' : editingId === null ? 'Create tier' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
