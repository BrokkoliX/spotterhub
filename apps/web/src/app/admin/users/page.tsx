'use client';

import { useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  ADMIN_UPDATE_USER_ROLE,
  ADMIN_UPDATE_USER_STATUS,
} from '@/lib/queries';
import { useAdminUsersQuery } from '@/lib/generated/graphql';

import styles from '../page.module.css';

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  admin: styles.badgeAdmin,
  moderator: styles.badgeModerator,
  user: styles.badgeUser,
};

const STATUS_BADGE: Record<string, string> = {
  active: styles.badgeActive,
  suspended: styles.badgeSuspended,
  banned: styles.badgeBanned,
};

export default function AdminUsersPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');
  const canManage = user?.role === 'admin';

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [{ data, fetching }, reexecute] = useAdminUsersQuery({
    variables: {
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
      first: PAGE_SIZE,
    },
    pause: !isAdmin,
  });

  const [, updateRole] = useMutation(ADMIN_UPDATE_USER_ROLE);
  const [, updateStatus] = useMutation(ADMIN_UPDATE_USER_STATUS);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const users = data?.adminUsers;

  const handleRoleChange = async (userId: string, role: string) => {
    await updateRole({ userId, role });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleStatusChange = async (userId: string, status: string) => {
    await updateStatus({ userId, status });
    reexecute({ requestPolicy: 'network-only' });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Users</h1>

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Search username or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {users && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {users.totalCount} user{users.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}

      {users && users.edges.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.edges.map(({ node }) => (
              <tr key={node.id}>
                <td>{node.username}</td>
                <td>{node.email}</td>
                <td>
                  <span className={`${styles.badge} ${ROLE_BADGE[node.role] ?? ''}`}>
                    {node.role}
                  </span>
                </td>
                <td>
                  <span className={`${styles.badge} ${STATUS_BADGE[node.status] ?? ''}`}>
                    {node.status}
                  </span>
                </td>
                <td>{new Date(node.createdAt).toLocaleDateString()}</td>
                {canManage && (
                  <td>
                    {node.role === 'user' && (
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleRoleChange(node.id, 'moderator')}
                      >
                        → Mod
                      </button>
                    )}
                    {node.role === 'moderator' && (
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleRoleChange(node.id, 'user')}
                      >
                        → User
                      </button>
                    )}
                    {node.status === 'active' && node.role !== 'admin' && (
                      <button
                        className={styles.actionBtnDanger}
                        onClick={() => handleStatusChange(node.id, 'suspended')}
                      >
                        Suspend
                      </button>
                    )}
                    {node.status === 'suspended' && (
                      <button
                        className={styles.actionBtnSuccess}
                        onClick={() => handleStatusChange(node.id, 'active')}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {users && users.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No users found</div>
      )}

      {users?.pageInfo?.hasNextPage && (
        <button className={`btn btn-secondary ${styles.loadMore}`}>Load more</button>
      )}
    </div>
  );
}
