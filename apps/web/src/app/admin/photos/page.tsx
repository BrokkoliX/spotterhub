'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { APPROVE_PHOTO, REJECT_PHOTO } from '@/lib/queries';
import type { AdminPhotosQuery } from '@/lib/generated/graphql';
import { useAdminPhotosQuery } from '@/lib/generated/graphql';

import { Pagination } from '@/components/Pagination';
import styles from '../page.module.css';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, string> = {
  pending: styles.badgePending,
  approved: styles.badgeApproved,
  rejected: styles.badgeRejected,
};

type PhotoNode = AdminPhotosQuery['adminPhotos']['edges'][number]['node'];

function thumbUrl(photo: PhotoNode): string {
  const variant = photo.variants?.find((v) => v.variantType === 'thumbnail');
  return variant?.url ?? photo.originalUrl;
}

export default function AdminPhotosPage() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);

  const [{ data, fetching }, reexecute] = useAdminPhotosQuery({
    variables: {
      moderationStatus: statusFilter || undefined,
      first: PAGE_SIZE,
      page: currentPage,
    },
    pause: !isAdmin,
  });

  const [, approvePhoto] = useMutation(APPROVE_PHOTO);
  const [, rejectPhoto] = useMutation(REJECT_PHOTO);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const photos = data?.adminPhotos;
  const totalCount = photos?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleApprove = async (photoId: string) => {
    await approvePhoto({ photoId });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleReject = async (photoId: string) => {
    await rejectPhoto({ photoId });
    reexecute({ requestPolicy: 'network-only' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    reexecute({ requestPolicy: 'network-only', variables: { moderationStatus: statusFilter || undefined, first: PAGE_SIZE, page } });
  };

  return (
    <div className={styles.page}>
      <div className="container">
      <h1 className={styles.title}>Photo Moderation</h1>

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
            {photos.edges.map(({ node }) => (
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
                      onClick={() => handleApprove(node.id)}
                    >
                      Approve
                    </button>
                  )}
                  {node.moderationStatus !== 'rejected' && (
                    <button
                      className={styles.actionBtnDanger}
                      onClick={() => handleReject(node.id)}
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

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={fetching}
        />
      )}
      </div>
    </div>
  );
}
