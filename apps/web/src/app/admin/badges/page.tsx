'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  GET_BADGE_DEFINITIONS,
  CREATE_BADGE_DEFINITION,
  UPDATE_BADGE_DEFINITION,
  DELETE_BADGE_DEFINITION,
} from '@/lib/queries';

import styles from '../page.module.css';

const CATEGORIES = ['UPLOAD', 'ENGAGEMENT', 'COMMUNITY', 'STREAK', 'DIVERSITY', 'AWARD'] as const;
const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const TRIGGER_TYPES = ['AUTOMATIC', 'AWARDED'] as const;

interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  tier: string;
  triggerType: string;
  triggerMetric: string | null;
  triggerThreshold: number | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminBadgesPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');
  const canManage = user?.role === 'admin' || user?.role === 'superuser';

  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('UPLOAD');
  const [formTier, setFormTier] = useState<string>('BRONZE');
  const [formTriggerType, setFormTriggerType] = useState<string>('AWARDED');
  const [formTriggerMetric, setFormTriggerMetric] = useState('');
  const [formTriggerThreshold, setFormTriggerThreshold] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState('0');

  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_BADGE_DEFINITIONS,
    variables: {
      category: categoryFilter || undefined,
    },
    pause: !isAdmin,
  });

  const [, createBadge] = useMutation(CREATE_BADGE_DEFINITION);
  const [, updateBadge] = useMutation(UPDATE_BADGE_DEFINITION);
  const [, deleteBadge] = useMutation(DELETE_BADGE_DEFINITION);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const badges: BadgeDefinition[] = data?.badgeDefinitions ?? [];

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormCategory('UPLOAD');
    setFormTier('BRONZE');
    setFormTriggerType('AWARDED');
    setFormTriggerMetric('');
    setFormTriggerThreshold('');
    setFormDisplayOrder('0');
  };

  const handleCreate = async () => {
    if (!formName || !formSlug) return;
    await createBadge({
      input: {
        name: formName,
        slug: formSlug,
        description: formDescription,
        category: formCategory,
        tier: formTier,
        triggerType: formTriggerType,
        triggerMetric: formTriggerMetric || undefined,
        triggerThreshold: formTriggerThreshold ? parseInt(formTriggerThreshold, 10) : undefined,
        displayOrder: parseInt(formDisplayOrder, 10) || 0,
      },
    });
    resetForm();
    setShowCreateForm(false);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleToggleActive = async (badge: BadgeDefinition) => {
    await updateBadge({
      id: badge.id,
      input: { isActive: !badge.isActive },
    });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this badge definition? This cannot be undone.')) return;
    await deleteBadge({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Badge Definitions</h1>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {canManage && (
            <button
              className={styles.actionBtn}
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : '+ New Badge'}
            </button>
          )}

          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {badges.length} badge{badges.length !== 1 ? 's' : ''}
          </span>
        </div>

        {showCreateForm && canManage && (
          <div style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
              <input className={styles.filterInput} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="First Upload" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Slug</label>
              <input className={styles.filterInput} value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="first-upload" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
              <input className={styles.filterInput} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Upload your first photo" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select className={styles.filterSelect} value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Tier</label>
              <select className={styles.filterSelect} value={formTier} onChange={(e) => setFormTier(e.target.value)}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Trigger Type</label>
              <select className={styles.filterSelect} value={formTriggerType} onChange={(e) => setFormTriggerType(e.target.value)}>
                {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Trigger Metric</label>
              <input className={styles.filterInput} value={formTriggerMetric} onChange={(e) => setFormTriggerMetric(e.target.value)} placeholder="photo_count" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Threshold</label>
              <input className={styles.filterInput} type="number" value={formTriggerThreshold} onChange={(e) => setFormTriggerThreshold(e.target.value)} placeholder="1" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Display Order</label>
              <input className={styles.filterInput} type="number" value={formDisplayOrder} onChange={(e) => setFormDisplayOrder(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className={styles.actionBtnSuccess} onClick={handleCreate}>
                Create Badge
              </button>
            </div>
          </div>
        )}

        {fetching && <div className={styles.loading}>Loading…</div>}

        {!fetching && badges.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Category</th>
                <th>Tier</th>
                <th>Trigger Type</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Active</th>
                <th>Order</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {badges.map((badge) => (
                <tr key={badge.id}>
                  <td>{badge.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{badge.slug}</td>
                  <td>
                    <span className={styles.badge}>{badge.category}</span>
                  </td>
                  <td>
                    <span className={styles.badge}>{badge.tier}</span>
                  </td>
                  <td>{badge.triggerType}</td>
                  <td>{badge.triggerMetric ?? '—'}</td>
                  <td>{badge.triggerThreshold ?? '—'}</td>
                  <td>
                    {canManage ? (
                      <button
                        className={badge.isActive ? styles.actionBtnSuccess : styles.actionBtnDanger}
                        onClick={() => handleToggleActive(badge)}
                        style={{ minWidth: 60 }}
                      >
                        {badge.isActive ? 'Yes' : 'No'}
                      </button>
                    ) : (
                      badge.isActive ? 'Yes' : 'No'
                    )}
                  </td>
                  <td>{badge.displayOrder}</td>
                  {canManage && (
                    <td>
                      <button
                        className={styles.actionBtnDanger}
                        onClick={() => handleDelete(badge.id)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!fetching && badges.length === 0 && (
          <div className={styles.loading}>No badge definitions found</div>
        )}
      </div>
    </div>
  );
}
