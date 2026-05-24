'use client';

import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';
import { UserDetailDrawer } from '@/components/admin/UserDetailDrawer';
import { useAdminUsersQuery } from '@/lib/generated/graphql';

import styles from '../page.module.css';
import rowStyles from './page.module.css';

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  superuser: styles.badgeAdmin,
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
  const isSuperuser = user?.role === 'superuser';

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useAdminUsersQuery({
    variables: {
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
      first: PAGE_SIZE,
      page: currentPage,
    },
    pause: !isSuperuser,
  });

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isSuperuser) return <div className={styles.denied}>Access denied — superuser only</div>;

  const users = data?.adminUsers;
  const totalCount = users?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    reexecute({ requestPolicy: 'network-only' });
  };

  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Users</h1>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All roles</option>
            <option value="superuser">Superuser</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="user">User</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
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
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          {users && (
            <span className={rowStyles.totalCount}>
              {totalCount} user{totalCount !== 1 ? 's' : ''}
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
                <th>Tier</th>
                <th>Joined</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.edges.map(({ node }) => (
                <tr
                  key={node.id}
                  className={rowStyles.clickableRow}
                  onClick={() => setSelectedUserId(node.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedUserId(node.id);
                    }
                  }}
                >
                  <td>{node.username}</td>
                  <td>{node.email ?? '—'}</td>
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
                  <td>{node.tier?.name ?? '—'}</td>
                  <td>{new Date(node.createdAt).toLocaleDateString()}</td>
                  <td>
                    {node.lastLoginAt ? new Date(node.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {users && users.edges.length === 0 && !fetching && (
          <div className={styles.loading}>No users found</div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={fetching}
          />
        )}
      </div>

      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onChange={refresh}
      />
    </div>
  );
}
