'use client';

import { useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADMIN_RESOLVE_REPORT } from '@/lib/queries';
import { useAdminReportsQuery } from '@/lib/generated/graphql';

import styles from '../page.module.css';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, string> = {
  open: styles.badgeOpen,
  resolved: styles.badgeResolved,
  dismissed: styles.badgeDismissed,
};

export default function AdminReportsPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');
  const [statusFilter, setStatusFilter] = useState('open');

  const [{ data, fetching }, reexecute] = useAdminReportsQuery({
    variables: { status: statusFilter || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });

  const [, resolveReport] = useMutation(ADMIN_RESOLVE_REPORT);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const reports = data?.adminReports;
  const hasNextPage = reports?.pageInfo?.hasNextPage;
  const endCursor = reports?.pageInfo?.endCursor;

  const handleResolve = async (id: string, action: string) => {
    await resolveReport({ id, action });
    reexecute({ requestPolicy: 'network-only' });
  };

  const loadMore = () => {
    if (!endCursor) return;
    reexecute({ requestPolicy: 'network-only', variables: { status: statusFilter || undefined, first: PAGE_SIZE, after: endCursor } });
  };

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Reports</h1>

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        {reports && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {reports.totalCount} report{reports.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}

      {reports && reports.edges.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Reporter</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.edges.map(({ node }) => (
              <tr key={node.id}>
                <td>{node.targetType}</td>
                <td>{node.reason}</td>
                <td>{node.reporter?.username ?? '—'}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_BADGE[node.status] ?? ''}`}>
                    {node.status}
                  </span>
                </td>
                <td>{new Date(node.createdAt).toLocaleDateString()}</td>
                <td>
                  {node.status === 'open' && (
                    <>
                      <button
                        className={styles.actionBtnSuccess}
                        onClick={() => handleResolve(node.id, 'resolved')}
                      >
                        Resolve
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleResolve(node.id, 'dismissed')}
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {node.status !== 'open' && node.reviewer && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      by {node.reviewer.username}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reports && reports.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No reports found</div>
      )}

      {hasNextPage && (
        <button className={`btn btn-secondary ${styles.loadMore}`} onClick={loadMore} disabled={fetching}>Load more</button>
      )}
      </div>
    </div>
  );
}
