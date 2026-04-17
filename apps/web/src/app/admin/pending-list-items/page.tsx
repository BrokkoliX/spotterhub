'use client';

import { type FormEvent, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADMIN_PENDING_LIST_ITEMS, REVIEW_LIST_ITEM } from '@/lib/queries';

import styles from '../page.module.css';

const PAGE_SIZE = 50;

type PendingListItemNode = {
  id: string;
  listType: string;
  value: string;
  metadata: unknown;
  status: string;
  reviewNote: string | null;
  submitter: { id: string; username: string };
  reviewer: { id: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminPendingListItemsPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<PendingListItemNode | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [result, reexecute] = useQuery({
    query: ADMIN_PENDING_LIST_ITEMS,
    variables: { status: statusFilter || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });
  const { data, fetching, error } = result;

  const [, reviewListItem] = useMutation(REVIEW_LIST_ITEM);

  const items = data?.pendingListItems;
  const hasNextPage = items?.pageInfo?.hasNextPage;
  const endCursor = items?.pageInfo?.endCursor;

  const openReview = (item: PendingListItemNode, status: 'approved' | 'rejected') => {
    setReviewingItem(item);
    setReviewStatus(status);
    setReviewNote('');
    setFormError(null);
    setShowReviewModal(true);
  };

  const handleReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;
    setFormError(null);
    setFormLoading(true);

    const res = await reviewListItem({
      id: reviewingItem.id,
      status: reviewStatus,
      reviewNote: reviewNote.trim() || undefined,
    });

    setFormLoading(false);
    if (res.error) { setFormError(res.error.graphQLErrors[0]?.message ?? 'Failed'); return; }

    setShowReviewModal(false);
    setReviewingItem(null);
    reexecute({ requestPolicy: 'network-only' });
  };

  const loadMore = () => {
    if (!endCursor) return;
    reexecute({ requestPolicy: 'network-only', variables: { status: statusFilter || undefined, first: PAGE_SIZE, after: endCursor } });
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return styles.badgeApproved;
      case 'rejected': return styles.badgeRejected;
      case 'pending': return styles.badgePending;
      default: return '';
    }
  };

  const formatMetadata = (metadata: unknown): string => {
    if (!metadata) return '—';
    try {
      const obj = metadata as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch {
      return '—';
    }
  };

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Pending List Items</h1>

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {items && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {items.totalCount} item{items.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.loading}>Error loading items</div>}

      {items && items.edges.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Value</th>
                <th>Metadata</th>
                <th>Submitted by</th>
                <th>Reviewed by</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.edges.map(({ node }: { node: PendingListItemNode }) => (
                <tr key={node.id}>
                  <td><span className={`${styles.badge} ${statusBadgeClass(node.status)}`}>{node.status}</span></td>
                  <td>{node.listType}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.value}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatMetadata(node.metadata)}>{formatMetadata(node.metadata)}</td>
                  <td>{node.submitter.username}</td>
                  <td>{node.reviewer?.username ?? '—'}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(node.createdAt).toLocaleDateString()}</td>
                  <td>
                    {node.status === 'pending' && (
                      <>
                        <button className={styles.actionBtnSuccess} onClick={() => openReview(node, 'approved')}>Approve</button>
                        <button className={styles.actionBtnDanger} onClick={() => openReview(node, 'rejected')}>Reject</button>
                      </>
                    )}
                    {node.status !== 'pending' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {node.reviewNote ? <span title={node.reviewNote}>Reviewed</span> : 'Reviewed'}
                      </span>
                    )}
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

      {items && items.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No items found</div>
      )}
      </div>

      {/* Review Modal */}
      {showReviewModal && reviewingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>
              {reviewStatus === 'approved' ? 'Approve' : 'Reject'} List Item
            </h2>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
              <div><strong>Type:</strong> {reviewingItem.listType}</div>
              <div><strong>Value:</strong> {reviewingItem.value}</div>
              <div><strong>Submitted by:</strong> {reviewingItem.submitter.username}</div>
              {!!reviewingItem.metadata && <div><strong>Metadata:</strong> {formatMetadata(reviewingItem.metadata)}</div>}
            </div>
            <form onSubmit={handleReview}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}>Review Note (optional)</label>
                <textarea
                  className="input"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={reviewStatus === 'approved' ? 'Add note (e.g., confirmed via official source)…' : 'Reason for rejection…'}
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              {formError && <p className="error-text" style={{ marginBottom: 12 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ background: reviewStatus === 'rejected' ? '#f87171' : undefined }}>
                  {formLoading ? 'Processing…' : reviewStatus === 'approved' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
