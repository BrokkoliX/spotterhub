'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADMIN_PHOTOS, ADMIN_UPDATE_PHOTO_MODERATION } from '@/lib/queries';

import styles from '../page.module.css';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, string> = {
  pending: styles.badgePending,
  approved: styles.badgeApproved,
  rejected: styles.badgeRejected,
};

function thumbUrl(photo: any): string {
  const variant = photo.variants?.find((v: any) => v.variantType === 'thumbnail');
  return variant?.url ?? photo.originalUrl;
}

export default function AdminPhotosPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');
  const [statusFilter, setStatusFilter] = useState('pending');

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PHOTOS,
    variables: {
      moderationStatus: statusFilter || undefined,
      first: PAGE_SIZE,
    },
    pause: !isAdmin,
  });

  const [, updateModeration] = useMutation(ADMIN_UPDATE_PHOTO_MODERATION);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const photos = data?.adminPhotos;

  const handleModeration = async (photoId: string, status: string) => {
    await updateModeration({ photoId, status });
    reexecute({ requestPolicy: 'network-only' });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Photo Moderation</h1>

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
        {photos && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {photos.totalCount} photo{photos.totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}

      {photos && photos.edges.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Caption</th>
              <th>User</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {photos.edges.map(({ node }: { node: any }) => (
              <tr key={node.id}>
                <td>
                  <Link href={`/photos/${node.id}`}>
                    <Image
                      src={thumbUrl(node)}
                      alt={node.caption ?? 'Photo'}
                      width={48}
                      height={48}
                      className={styles.photoThumb}
                      unoptimized
                    />
                  </Link>
                </td>
                <td>{node.caption ?? '—'}</td>
                <td>{node.user?.username ?? '—'}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_BADGE[node.moderationStatus] ?? ''}`}>
                    {node.moderationStatus}
                  </span>
                </td>
                <td>{new Date(node.createdAt).toLocaleDateString()}</td>
                <td>
                  {node.moderationStatus !== 'approved' && (
                    <button
                      className={styles.actionBtnSuccess}
                      onClick={() => handleModeration(node.id, 'approved')}
                    >
                      Approve
                    </button>
                  )}
                  {node.moderationStatus !== 'rejected' && (
                    <button
                      className={styles.actionBtnDanger}
                      onClick={() => handleModeration(node.id, 'rejected')}
                    >
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {photos && photos.edges.length === 0 && !fetching && (
        <div className={styles.loading}>No photos found</div>
      )}

      {photos?.pageInfo?.hasNextPage && (
        <button className={`btn btn-secondary ${styles.loadMore}`}>Load more</button>
      )}
    </div>
  );
}
