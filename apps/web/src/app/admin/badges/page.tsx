'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_LOOKUP_PHOTO,
  ADMIN_USERS,
  AWARD_BADGE,
  CREATE_BADGE_DEFINITION,
  DELETE_BADGE_DEFINITION,
  GET_BADGE_DEFINITIONS,
  GET_USER_BADGES,
  REVOKE_BADGE,
  UPDATE_BADGE_DEFINITION,
} from '@/lib/queries';

import styles from '../page.module.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['UPLOAD', 'ENGAGEMENT', 'COMMUNITY', 'STREAK', 'DIVERSITY', 'AWARD'] as const;
const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const TRIGGER_TYPES = ['AUTOMATIC', 'AWARDED'] as const;

// Known automatic metrics. These must match the cases in
// `computeMetricValue()` inside apps/api/src/resolvers/badgeResolvers.ts —
// adding a new case there should also be reflected here so the dropdown
// stays in sync.
const KNOWN_METRICS: Array<{ value: string; label: string }> = [
  { value: '', label: '— None (manual / awarded) —' },
  { value: 'photo_count', label: 'photo_count — Approved photos uploaded' },
  { value: 'like_received_count', label: 'like_received_count — Likes received on own photos' },
  { value: 'comment_count', label: 'comment_count — Comments authored' },
  { value: 'community_join_count', label: 'community_join_count — Communities joined' },
  { value: 'community_created_count', label: 'community_created_count — Communities created' },
  { value: 'unique_airport_count', label: 'unique_airport_count — Distinct airports photographed' },
  { value: 'upload_streak_days', label: 'upload_streak_days — Consecutive upload days' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

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
  isRepeatable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface UserSearchResult {
  id: string;
  username: string;
  email?: string | null;
  profile?: { displayName: string | null; avatarUrl: string | null } | null;
}

interface UserBadgeRow {
  id: string;
  awardedAt: string;
  user: { id: string; username: string };
  badgeDefinition: {
    id: string;
    slug: string;
    name: string;
    tier: string;
    isRepeatable: boolean;
  };
  awardedPhoto: {
    id: string;
    caption: string | null;
    variants: Array<{ variantType: string; url: string }>;
  } | null;
  awarder: { id: string; username: string } | null;
}

interface PhotoLookupResult {
  id: string;
  caption: string | null;
  user: { id: string; username: string };
  variants: Array<{ variantType: string; url: string }>;
}

// ─── User search input ──────────────────────────────────────────────────────

function UserSearchInput({
  value,
  onChange,
}: {
  value: UserSearchResult | null;
  onChange: (user: UserSearchResult | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [{ data, fetching }] = useQuery({
    query: ADMIN_USERS,
    variables: { search: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  const handleChange = (raw: string) => {
    setQuery(raw);
    setOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (raw.length >= 2) {
        setDebouncedQuery(raw);
        setOpen(true);
      } else {
        setDebouncedQuery('');
      }
    }, 300);
  };

  if (value) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span style={{ fontWeight: 600 }}>@{value.username}</span>
        {value.profile?.displayName && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            ({value.profile.displayName})
          </span>
        )}
        <button
          type="button"
          className={styles.actionBtnDanger}
          onClick={() => onChange(null)}
          style={{ marginLeft: 'auto' }}
        >
          Clear
        </button>
      </div>
    );
  }

  const results: UserSearchResult[] =
    data?.adminUsers?.edges?.map((e: { node: UserSearchResult }) => e.node) ?? [];

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={styles.filterInput}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search by username or email…"
        autoComplete="off"
      />
      {open && debouncedQuery.length >= 2 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {fetching && <li style={{ padding: 8, color: 'var(--color-text-muted)' }}>Searching…</li>}
          {!fetching && results.length === 0 && (
            <li style={{ padding: 8, color: 'var(--color-text-muted)' }}>No users found</li>
          )}
          {results.map((u) => (
            <li
              key={u.id}
              onMouseDown={() => {
                onChange(u);
                setQuery('');
                setOpen(false);
              }}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontWeight: 600 }}>@{u.username}</div>
              {u.profile?.displayName && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {u.profile.displayName}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Photo preview by ID ─────────────────────────────────────────────────────

function PhotoPreview({ photoId }: { photoId: string }) {
  const [{ data, fetching, error }] = useQuery({
    query: ADMIN_LOOKUP_PHOTO,
    variables: { id: photoId },
    pause: !photoId || photoId.length < 8,
  });

  if (!photoId) return null;
  if (fetching) {
    return (
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        Loading photo…
      </span>
    );
  }
  if (error || !data?.photo) {
    return (
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger, #c33)' }}>
        No photo found with that ID
      </span>
    );
  }
  const photo = data.photo as PhotoLookupResult;
  const thumb = photo.variants.find((v) => v.variantType === 'thumbnail') ?? photo.variants[0];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element -- admin tool, tiny preview
        <img
          src={thumb.url}
          alt=""
          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
        />
      )}
      <span>by @{photo.user.username}</span>
      {photo.caption && (
        <span style={{ color: 'var(--color-text-muted)' }}>— {photo.caption.slice(0, 60)}</span>
      )}
    </div>
  );
}

// ─── Awards list per user ────────────────────────────────────────────────────

function UserAwardsList({ userId, onRevoked }: { userId: string; onRevoked: () => void }) {
  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_USER_BADGES,
    variables: { userId },
    requestPolicy: 'cache-and-network',
  });

  const [, revokeBadge] = useMutation(REVOKE_BADGE);

  const handleRevoke = async (row: UserBadgeRow) => {
    if (!confirm(`Revoke "${row.badgeDefinition.name}" from @${row.user.username}?`)) return;
    await revokeBadge({
      userId: row.user.id,
      badgeDefinitionId: row.badgeDefinition.id,
      userBadgeId: row.id,
    });
    reexecute({ requestPolicy: 'network-only' });
    onRevoked();
  };

  if (fetching) return <div className={styles.loading}>Loading awards…</div>;
  const rows: UserBadgeRow[] = data?.userBadges ?? [];
  if (rows.length === 0)
    return <div className={styles.loading}>No badges awarded to this user yet.</div>;

  return (
    <table className={styles.table} style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th>Badge</th>
          <th>Tier</th>
          <th>Awarded</th>
          <th>Photo</th>
          <th>By</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const thumb = row.awardedPhoto?.variants.find((v) => v.variantType === 'thumbnail');
          return (
            <tr key={row.id}>
              <td>
                {row.badgeDefinition.name}
                {row.badgeDefinition.isRepeatable && (
                  <span
                    title="Repeatable"
                    style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
                  >
                    ↻
                  </span>
                )}
              </td>
              <td>
                <span className={styles.badge}>{row.badgeDefinition.tier}</span>
              </td>
              <td>{new Date(row.awardedAt).toLocaleString()}</td>
              <td>
                {row.awardedPhoto ? (
                  <Link
                    href={`/photos/${row.awardedPhoto.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin tool, tiny preview
                      <img
                        src={thumb.url}
                        alt=""
                        style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <span>view</span>
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td>{row.awarder ? `@${row.awarder.username}` : '—'}</td>
              <td>
                <button className={styles.actionBtnDanger} onClick={() => handleRevoke(row)}>
                  Revoke
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminBadgesPage() {
  const { user, ready } = useAuth();
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');
  const canManage = user?.role === 'admin' || user?.role === 'superuser';
  const canAward = user?.role === 'superuser'; // awardBadge mutation requires superuser

  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAwardForm, setShowAwardForm] = useState(false);

  // Definition form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('UPLOAD');
  const [formTier, setFormTier] = useState<string>('BRONZE');
  const [formTriggerType, setFormTriggerType] = useState<string>('AWARDED');
  const [formTriggerMetric, setFormTriggerMetric] = useState('');
  const [formTriggerThreshold, setFormTriggerThreshold] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState('0');
  const [formIsRepeatable, setFormIsRepeatable] = useState(false);

  // Award form state
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardUser, setAwardUser] = useState<UserSearchResult | null>(null);
  const [awardPhotoId, setAwardPhotoId] = useState('');
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);

  // User-awards explorer state — hooks must come before any early returns.
  const [awardsListUser, setAwardsListUser] = useState<UserSearchResult | null>(null);
  const [awardsListRefreshKey, setAwardsListRefreshKey] = useState(0);

  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_BADGE_DEFINITIONS,
    variables: { category: categoryFilter || undefined },
    pause: !isAdmin,
  });

  const [, createBadge] = useMutation(CREATE_BADGE_DEFINITION);
  const [, updateBadge] = useMutation(UPDATE_BADGE_DEFINITION);
  const [, deleteBadge] = useMutation(DELETE_BADGE_DEFINITION);
  const [, awardBadgeMutation] = useMutation(AWARD_BADGE);

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
    setFormIsRepeatable(false);
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
        isRepeatable: formIsRepeatable,
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

  const handleToggleRepeatable = async (badge: BadgeDefinition) => {
    await updateBadge({
      id: badge.id,
      input: { isRepeatable: !badge.isRepeatable },
    });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this badge definition? This cannot be undone.')) return;
    await deleteBadge({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const resetAwardForm = () => {
    setAwardBadgeId('');
    setAwardUser(null);
    setAwardPhotoId('');
  };

  const handleAward = async () => {
    setAwardError(null);
    setAwardSuccess(null);
    if (!awardBadgeId || !awardUser) {
      setAwardError('Pick a badge and a user.');
      return;
    }
    const result = await awardBadgeMutation({
      badgeDefinitionId: awardBadgeId,
      userId: awardUser.id,
      photoId: awardPhotoId || undefined,
    });
    if (result.error) {
      setAwardError(result.error.graphQLErrors?.[0]?.message ?? result.error.message);
      return;
    }
    const granted = result.data?.awardBadge;
    setAwardSuccess(
      `Awarded "${granted?.badgeDefinition?.name}" (${granted?.badgeDefinition?.tier}) to @${granted?.user?.username}.`,
    );
    resetAwardForm();
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Badges</h1>

        {/* ─── Award Manager ──────────────────────────────────────────── */}
        {canAward && (
          <section
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 16,
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>🏆 Manual award</h2>
              <button className={styles.actionBtn} onClick={() => setShowAwardForm(!showAwardForm)}>
                {showAwardForm ? 'Hide' : 'Award a badge'}
              </button>
            </div>
            {showAwardForm && (
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Badge
                  </label>
                  <select
                    className={styles.filterSelect}
                    value={awardBadgeId}
                    onChange={(e) => setAwardBadgeId(e.target.value)}
                  >
                    <option value="">— Select a badge —</option>
                    {badges
                      .filter((b) => b.triggerType === 'AWARDED' && b.isActive)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.tier}){b.isRepeatable ? ' ↻' : ''}
                        </option>
                      ))}
                  </select>
                  <div
                    style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}
                  >
                    Only AWARDED + active badges can be granted manually. Automatic badges are
                    granted by the engine when a user crosses a threshold.
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Recipient
                  </label>
                  <UserSearchInput value={awardUser} onChange={setAwardUser} />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Photo ID (optional — required for repeatable badges tied to specific photos)
                  </label>
                  <input
                    className={styles.filterInput}
                    value={awardPhotoId}
                    onChange={(e) => setAwardPhotoId(e.target.value.trim())}
                    placeholder="UUID of the photo this badge celebrates"
                  />
                  {awardPhotoId.length >= 8 && (
                    <div style={{ marginTop: 6 }}>
                      <PhotoPreview photoId={awardPhotoId} />
                    </div>
                  )}
                </div>

                {awardError && (
                  <div style={{ color: 'var(--color-danger, #c33)', fontSize: '0.875rem' }}>
                    {awardError}
                  </div>
                )}
                {awardSuccess && (
                  <div style={{ color: 'var(--color-success, #2a7)', fontSize: '0.875rem' }}>
                    {awardSuccess}
                  </div>
                )}

                <div>
                  <button className={styles.actionBtnSuccess} onClick={handleAward}>
                    Award badge
                  </button>
                </div>
              </div>
            )}

            {/* User awards explorer */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>View awards by user</h3>
              <div style={{ marginTop: 8 }}>
                <UserSearchInput value={awardsListUser} onChange={setAwardsListUser} />
              </div>
              {awardsListUser && (
                <UserAwardsList
                  key={`${awardsListUser.id}-${awardsListRefreshKey}`}
                  userId={awardsListUser.id}
                  onRevoked={() => setAwardsListRefreshKey((k) => k + 1)}
                />
              )}
            </div>
          </section>
        )}

        {/* ─── Definitions ────────────────────────────────────────────── */}
        <h2 style={{ fontSize: '1.125rem', marginTop: 0 }}>Definitions</h2>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {canManage && (
            <button className={styles.actionBtn} onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : '+ New Badge'}
            </button>
          )}

          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {badges.length} badge{badges.length !== 1 ? 's' : ''}
          </span>
        </div>

        {showCreateForm && canManage && (
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Name
              </label>
              <input
                className={styles.filterInput}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="First Upload"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Slug
              </label>
              <input
                className={styles.filterInput}
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="first-upload"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Description
              </label>
              <input
                className={styles.filterInput}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Upload your first photo"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Category
              </label>
              <select
                className={styles.filterSelect}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Tier
              </label>
              <select
                className={styles.filterSelect}
                value={formTier}
                onChange={(e) => setFormTier(e.target.value)}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Trigger Type
              </label>
              <select
                className={styles.filterSelect}
                value={formTriggerType}
                onChange={(e) => {
                  setFormTriggerType(e.target.value);
                  // Manually-awarded badges don't use a metric.
                  if (e.target.value === 'AWARDED') {
                    setFormTriggerMetric('');
                    setFormTriggerThreshold('');
                  }
                }}
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Trigger Metric
              </label>
              <select
                className={styles.filterSelect}
                value={formTriggerMetric}
                onChange={(e) => setFormTriggerMetric(e.target.value)}
                disabled={formTriggerType !== 'AUTOMATIC'}
              >
                {KNOWN_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Only applies when Trigger Type is AUTOMATIC. Adding a new metric requires an API
                code change too — see badgeResolvers.ts.
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Threshold
              </label>
              <input
                className={styles.filterInput}
                type="number"
                value={formTriggerThreshold}
                onChange={(e) => setFormTriggerThreshold(e.target.value)}
                placeholder="1"
                disabled={formTriggerType !== 'AUTOMATIC'}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Display Order
              </label>
              <input
                className={styles.filterInput}
                type="number"
                value={formDisplayOrder}
                onChange={(e) => setFormDisplayOrder(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={formIsRepeatable}
                  onChange={(e) => setFormIsRepeatable(e.target.checked)}
                />
                Repeatable (can be earned multiple times — typically tied to different photos)
              </label>
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
                <th>Repeatable</th>
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
                        className={badge.isRepeatable ? styles.actionBtnSuccess : styles.actionBtn}
                        onClick={() => handleToggleRepeatable(badge)}
                        style={{ minWidth: 60 }}
                      >
                        {badge.isRepeatable ? 'Yes' : 'No'}
                      </button>
                    ) : badge.isRepeatable ? (
                      'Yes'
                    ) : (
                      'No'
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        className={
                          badge.isActive ? styles.actionBtnSuccess : styles.actionBtnDanger
                        }
                        onClick={() => handleToggleActive(badge)}
                        style={{ minWidth: 60 }}
                      >
                        {badge.isActive ? 'Yes' : 'No'}
                      </button>
                    ) : badge.isActive ? (
                      'Yes'
                    ) : (
                      'No'
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
