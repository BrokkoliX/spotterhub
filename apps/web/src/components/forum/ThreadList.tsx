'use client';

import type { ReactNode } from 'react';

import { ThreadCard, type ThreadCardData } from './ThreadCard';
import styles from './forum.module.css';

export interface ThreadListProps {
  threads: ThreadCardData[];
  /** Builds the href for a given thread. */
  buildHref: (thread: ThreadCardData) => string;
  fetching: boolean;
  /** Total count from the server, if available. */
  totalCount?: number;
  /** Empty-state content shown when there are no threads. */
  emptyState?: ReactNode;
  /** Optional toolbar (sort/filter/search) rendered above the list. */
  toolbar?: ReactNode;
}

const SKELETON_KEYS = ['s1', 's2', 's3'] as const;

function ThreadListSkeleton() {
  return (
    <div className={styles.listGroup} aria-hidden="true">
      {SKELETON_KEYS.map((key) => (
        <div key={key} className={styles.skeletonCard}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineLong}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          </div>
          <div />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a grouped, responsive list of forum threads. Pinned threads are
 * separated into a leading group; the remaining threads are grouped under
 * "Latest". Loading and empty states use card-style panels that match the
 * rest of the application.
 */
export function ThreadList({
  threads,
  buildHref,
  fetching,
  totalCount,
  emptyState,
  toolbar,
}: ThreadListProps) {
  const pinned = threads.filter((t) => t.isPinned);
  const regular = threads.filter((t) => !t.isPinned);

  const isEmpty = !fetching && threads.length === 0;

  return (
    <div className={styles.listWrapper}>
      {toolbar}

      {fetching && threads.length === 0 && <ThreadListSkeleton />}

      {isEmpty && (
        <div className={styles.statePanel}>
          {emptyState ?? (
            <>
              <div className={styles.stateTitle}>No threads yet</div>
              <div className={styles.stateBody}>Be the first to start a discussion.</div>
            </>
          )}
        </div>
      )}

      {pinned.length > 0 && (
        <div className={styles.listGroup}>
          <div className={styles.listGroupHeader}>
            <span>Pinned</span>
            <span className={styles.listGroupCount}>{pinned.length}</span>
          </div>
          {pinned.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} href={buildHref(thread)} />
          ))}
        </div>
      )}

      {regular.length > 0 && (
        <div className={styles.listGroup}>
          <div className={styles.listGroupHeader}>
            <span>{pinned.length > 0 ? 'Latest' : 'Threads'}</span>
            {typeof totalCount === 'number' && (
              <span className={styles.listGroupCount}>{totalCount}</span>
            )}
          </div>
          {regular.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} href={buildHref(thread)} />
          ))}
        </div>
      )}
    </div>
  );
}
