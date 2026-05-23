'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { notificationHref, notificationTypeLabel, relativeTime } from '@/lib/notifications';
import {
  DELETE_NOTIFICATION,
  GET_NOTIFICATIONS,
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
} from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 20;

type Filter = 'all' | 'unread';

interface NotificationNode {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsQueryData {
  notifications: {
    edges: { cursor: string; node: NotificationNode }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export default function NotificationsPage() {
  const { user, ready } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const [result, reexecute] = useQuery<NotificationsQueryData>({
    query: GET_NOTIFICATIONS,
    variables: {
      first: PAGE_SIZE,
      page,
      unreadOnly: filter === 'unread',
    },
    pause: !ready || !user,
    requestPolicy: 'cache-and-network',
  });

  const [, markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [, markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);
  const [, deleteNotification] = useMutation(DELETE_NOTIFICATION);

  if (!ready) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.denied}>Please sign in to view your notifications.</p>
        </div>
      </div>
    );
  }

  const edges = result.data?.notifications.edges ?? [];
  const hasNextPage = result.data?.notifications.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = page > 1;

  const handleFilterChange = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
  };

  const handleMarkRead = async (id: string) => {
    await markRead({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification? This cannot be undone.')) return;
    await deleteNotification({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleMarkAllRead = async () => {
    await markAllRead({});
    reexecute({ requestPolicy: 'network-only' });
  };

  // Mark-on-click: when the user clicks the body, the notification is
  // considered read. We do this *before* navigating so the next page load
  // reflects the new state.
  const handleNotificationClick = async (n: NotificationNode) => {
    if (!n.isRead) {
      await markRead({ id: n.id });
      reexecute({ requestPolicy: 'network-only' });
    }
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Notifications</h1>

        <div className={styles.toolbar}>
          <div className={styles.filterGroup} role="tablist" aria-label="Filter notifications">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              className={`${styles.filterBtn} ${filter === 'unread' ? styles.filterBtnActive : ''}`}
              onClick={() => handleFilterChange('unread')}
            >
              Unread
            </button>
          </div>
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={edges.every((e) => e.node.isRead)}
          >
            Mark all read
          </button>
        </div>

        {result.fetching && edges.length === 0 && (
          <p className={styles.loading}>Loading notifications…</p>
        )}

        {!result.fetching && edges.length === 0 && (
          <p className={styles.empty}>
            {filter === 'unread' ? 'No unread notifications.' : 'You have no notifications yet.'}
          </p>
        )}

        {edges.length > 0 && (
          <ul className={styles.list}>
            {edges.map(({ node }) => (
              <li
                key={node.id}
                className={`${styles.item} ${!node.isRead ? styles.itemUnread : ''}`}
              >
                <div className={styles.itemMain}>
                  <div className={styles.itemHeader}>
                    <span className={styles.typeBadge}>{notificationTypeLabel(node.type)}</span>
                    <span className={styles.itemTime}>{relativeTime(node.createdAt)}</span>
                  </div>
                  <Link
                    href={notificationHref(node.data)}
                    className={styles.itemLink}
                    onClick={() => handleNotificationClick(node)}
                  >
                    <span className={styles.itemTitle}>{node.title}</span>
                    {node.body && <span className={styles.itemBody}>{node.body}</span>}
                  </Link>
                </div>
                <div className={styles.itemActions}>
                  {!node.isRead && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleMarkRead(node.id)}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.actionBtnDanger}
                    onClick={() => handleDelete(node.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(hasPreviousPage || hasNextPage) && (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPreviousPage || result.fetching}
            >
              ← Newer
            </button>
            <span className={styles.pagerLabel}>Page {page}</span>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage || result.fetching}
            >
              Older →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
