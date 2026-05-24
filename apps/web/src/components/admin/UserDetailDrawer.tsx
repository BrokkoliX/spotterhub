'use client';

import { useEffect, useState } from 'react';
import { useMutation } from 'urql';

import { FilterDrawer } from '@/components/FilterDrawer';
import {
  ADMIN_ASSIGN_USER_TIER,
  ADMIN_UNLOCK_USER,
  ADMIN_UPDATE_USER_ROLE,
  ADMIN_UPDATE_USER_STATUS,
} from '@/lib/queries';
import { useAdminUserByIdQuery, useAdminTiersQuery } from '@/lib/generated/graphql';

import styles from './UserDetailDrawer.module.css';

interface UserDetailDrawerProps {
  userId: string | null;
  /** Called when the drawer should close. */
  onClose: () => void;
  /**
   * Called whenever a mutation in the drawer mutates the underlying user
   * record so the parent list can re-fetch its query.
   */
  onChange?: () => void;
}

const ROLE_OPTIONS = ['user', 'moderator', 'admin', 'superuser'] as const;
const STATUS_OPTIONS = ['active', 'suspended', 'banned'] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free';
  const amount = (cents / 100).toFixed(2);
  return `${amount} ${currency.toUpperCase()}`;
}

/**
 * Side-drawer that shows a single user's full administrative detail and
 * exposes the four superuser-only management actions: change role, change
 * status, unlock (clear failed login attempts), and reassign tier.
 *
 * Re-uses FilterDrawer so we get the same animation, Portal, and scroll
 * behaviour as elsewhere in the admin section.
 */
export function UserDetailDrawer({ userId, onClose, onChange }: UserDetailDrawerProps) {
  const isOpen = userId !== null;

  const [{ data, fetching, error }, refetchUser] = useAdminUserByIdQuery({
    variables: { id: userId ?? '' },
    pause: !isOpen,
    requestPolicy: 'network-only',
  });

  const [{ data: tiersData }] = useAdminTiersQuery({ pause: !isOpen });

  const [, updateRole] = useMutation(ADMIN_UPDATE_USER_ROLE);
  const [, updateStatus] = useMutation(ADMIN_UPDATE_USER_STATUS);
  const [, unlockUser] = useMutation(ADMIN_UNLOCK_USER);
  const [, assignTier] = useMutation(ADMIN_ASSIGN_USER_TIER);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset transient state every time the drawer is reopened for a new user.
  useEffect(() => {
    if (isOpen) {
      setBusy(false);
      setErrorMsg(null);
    }
  }, [isOpen, userId]);

  const user = data?.adminUserById;
  const tiers = tiersData?.adminTiers ?? [];

  const refreshAfterMutation = () => {
    refetchUser({ requestPolicy: 'network-only' });
    onChange?.();
  };

  const runMutation = async <T,>(
    label: string,
    fn: () => Promise<{ data?: T; error?: { message: string } | null }>,
  ) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fn();
      if (res.error) {
        setErrorMsg(`${label} failed: ${res.error.message}`);
        return;
      }
      refreshAfterMutation();
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (role: string) => {
    if (!user) return;
    void runMutation('Update role', () => updateRole({ userId: user.id, role }));
  };

  const handleStatusChange = (status: string) => {
    if (!user) return;
    void runMutation('Update status', () => updateStatus({ userId: user.id, status }));
  };

  const handleUnlock = () => {
    if (!user) return;
    void runMutation('Unlock', () => unlockUser({ userId: user.id }));
  };

  const handleTierChange = (tierId: string) => {
    if (!user) return;
    void runMutation('Assign tier', () =>
      assignTier({ userId: user.id, tierId: tierId === '' ? null : tierId }),
    );
  };

  return (
    <FilterDrawer isOpen={isOpen} onClose={onClose} title={user ? `@${user.username}` : 'User'}>
      {fetching && !user && <div className={styles.loading}>Loading…</div>}

      {error && <div className={styles.error}>Failed to load user: {error.message}</div>}

      {errorMsg && <div className={styles.error}>{errorMsg}</div>}

      {user && (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Identity</h3>
            <dl className={styles.dl}>
              <dt>Username</dt>
              <dd>{user.username}</dd>
              <dt>Email</dt>
              <dd>{user.email ?? '—'}</dd>
              <dt>Display name</dt>
              <dd>{user.profile?.displayName ?? '—'}</dd>
              <dt>User ID</dt>
              <dd className={styles.mono}>{user.id}</dd>
              <dt>Cognito sub</dt>
              <dd className={styles.mono}>{user.cognitoSub ?? '—'}</dd>
            </dl>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Account</h3>
            <dl className={styles.dl}>
              <dt>Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
              <dt>Last login</dt>
              <dd>{formatDate(user.lastLoginAt)}</dd>
              <dt>Failed attempts</dt>
              <dd>{user.failedAttempts ?? 0}</dd>
              <dt>Locked until</dt>
              <dd>{user.lockoutUntil ? formatDate(user.lockoutUntil) : 'Not locked'}</dd>
            </dl>
            {(user.lockoutUntil || (user.failedAttempts ?? 0) > 0) && (
              <button
                type="button"
                className={styles.unlockBtn}
                onClick={handleUnlock}
                disabled={busy}
              >
                Reset failed attempts &amp; unlock
              </button>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Role &amp; status</h3>
            <label className={styles.field}>
              <span>Role</span>
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={busy}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={user.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={busy}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tier</h3>
            <label className={styles.field}>
              <span>Assigned tier</span>
              <select
                value={user.tier?.id ?? ''}
                onChange={(e) => handleTierChange(e.target.value)}
                disabled={busy || tiers.length === 0}
              >
                <option value="">Default (free)</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.isActive}>
                    {t.name} ({formatPrice(t.priceCents, t.currency)})
                    {!t.isActive ? ' — inactive' : ''}
                  </option>
                ))}
              </select>
            </label>
            {user.tier && (
              <p className={styles.tierHint}>
                Currently on <strong>{user.tier.name}</strong> (
                {formatPrice(user.tier.priceCents, user.tier.currency)}
                ).
              </p>
            )}
          </section>
        </>
      )}
    </FilterDrawer>
  );
}
