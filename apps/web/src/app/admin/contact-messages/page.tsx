'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_CONTACT_MESSAGES, REVIEW_CONTACT_MESSAGE } from '@/lib/queries';

import styles from '../page.module.css';

const PAGE_SIZE = 20;

interface ContactMessageNode {
  id: string;
  subject: string;
  body: string;
  email: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; username: string; email: string } | null;
  reviewedByUser: { id: string; username: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  unread: styles.badgeOpen,
  read: styles.badgeBlue,
  resolved: styles.badgeResolved,
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminContactMessagesPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_CONTACT_MESSAGES,
    variables: { status: statusFilter || undefined, first: PAGE_SIZE },
    pause: !isAdmin,
  });

  const [, reviewMessage] = useMutation(REVIEW_CONTACT_MESSAGE);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const messages = data?.contactMessages;
  const hasNextPage = messages?.pageInfo?.hasNextPage;
  const endCursor = messages?.pageInfo?.endCursor;

  const handleReview = async (id: string, status: 'read' | 'resolved') => {
    await reviewMessage({ id, status });
    reexecute({ requestPolicy: 'network-only' });
  };

  const loadMore = () => {
    if (!endCursor) return;
    reexecute({
      requestPolicy: 'network-only',
      variables: { status: statusFilter || undefined, first: PAGE_SIZE, after: endCursor },
    });
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Contact Messages</h1>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
          {messages && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {messages.totalCount} message{messages.totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {fetching && <div className={styles.loading}>Loading…</div>}

        {messages && messages.edges.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.edges.map(({ node }: { node: ContactMessageNode }) => (
                  <>
                    <tr
                      key={node.id}
                      className={expandedId === node.id ? styles.rowActive : ''}
                      onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {node.user?.username ?? node.email ?? 'Anonymous'}
                        </div>
                        {node.email && node.user?.username && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {node.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: node.status === 'unread' ? 600 : 400 }}>
                          {node.subject}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${STATUS_BADGE[node.status] ?? ''}`}>
                          {node.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {timeAgo(node.createdAt)}
                        <br />
                        <span style={{ fontSize: '0.7rem' }}>{formatDate(node.createdAt)}</span>
                      </td>
                      <td>
                        {node.status === 'unread' && (
                          <button
                            className={styles.actionBtnSuccess}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(node.id, 'read');
                            }}
                          >
                            Mark Read
                          </button>
                        )}
                        {node.status === 'read' && (
                          <button
                            className={styles.actionBtnSuccess}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(node.id, 'resolved');
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === node.id && (
                      <tr key={`${node.id}-expanded`}>
                        <td colSpan={5} style={{ padding: '16px 24px', background: 'var(--color-bg-raised)' }}>
                          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.9rem' }}>
                            Message:
                          </div>
                          <p style={{ margin: '0 0 16px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {node.body}
                          </p>
                          {node.reviewedByUser && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              Reviewed by {node.reviewedByUser.username}
                              {node.reviewedAt && ` on ${formatDate(node.reviewedAt)}`}
                            </div>
                          )}
                          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                            {node.status === 'unread' && (
                              <button
                                className={styles.actionBtnSuccess}
                                onClick={() => handleReview(node.id, 'read')}
                              >
                                Mark as Read
                              </button>
                            )}
                            {node.status !== 'resolved' && (
                              <button
                                className={styles.actionBtnSuccess}
                                onClick={() => handleReview(node.id, 'resolved')}
                              >
                                Resolve
                              </button>
                            )}
                            <Link
                              href={`/u/${node.user?.username}`}
                              className={styles.actionBtn}
                              style={{ textDecoration: 'none' }}
                            >
                              View Profile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {messages && messages.edges.length === 0 && !fetching && (
          <div className={styles.loading}>No messages found</div>
        )}

        {hasNextPage && (
          <button
            className={`btn btn-secondary ${styles.loadMore}`}
            onClick={loadMore}
            disabled={fetching}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}