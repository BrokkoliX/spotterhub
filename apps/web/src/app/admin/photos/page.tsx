'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { APPROVE_PHOTO, REJECT_PHOTO } from '@/lib/queries';
import type { AdminPhotosQuery } from '@/lib/generated/graphql';
import { useAdminPhotosQuery } from '@/lib/generated/graphql';

import { Pagination } from '@/components/Pagination';
import styles from '../page.module.css';

const PAGE_SIZE = 20;
const REASON_MAX_LENGTH = 500;

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
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);

  // Reject modal state — non-null while a moderator is composing a rejection.
  const [rejectingPhoto, setRejectingPhoto] = useState<PhotoNode | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

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

  const openRejectModal = (photo: PhotoNode) => {
    setRejectingPhoto(photo);
    setRejectReason('');
    setRejectError(null);
  };

  const closeRejectModal = () => {
    if (rejectSubmitting) return;
    setRejectingPhoto(null);
    setRejectReason('');
    setRejectError(null);
  };

  const handleRejectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingPhoto) return;
    setRejectSubmitting(true);
    setRejectError(null);

    const trimmed = rejectReason.trim();
    const result = await rejectPhoto({
      photoId: rejectingPhoto.id,
      // Send `undefined` (not "") when the moderator left the field blank so
      // the backend falls back to its generic "rejected by a moderator" body.
      reason: trimmed === '' ? undefined : trimmed,
    });

    setRejectSubmitting(false);
    if (result.error) {
      setRejectError(result.error.graphQLErrors[0]?.message ?? 'Failed to reject photo');
      return;
    }

    setRejectingPhoto(null);
    setRejectReason('');
    reexecute({ requestPolicy: 'network-only' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    reexecute({
      requestPolicy: 'network-only',
      variables: { moderationStatus: statusFilter || undefined, first: PAGE_SIZE, page },
    });
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Photo Moderation</h1>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
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
                    <span
                      className={`${styles.badge} ${STATUS_BADGE[node.moderationStatus] ?? ''}`}
                    >
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
                        onClick={() => openRejectModal(node)}
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

      {/* Reject Modal */}
      {rejectingPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={closeRejectModal}
        >
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '100%',
              maxWidth: 520,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 16, fontSize: '1.125rem' }}>Reject Photo</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <Image
                src={thumbUrl(rejectingPhoto)}
                alt={rejectingPhoto.caption ?? 'Photo'}
                width={56}
                height={56}
                className={styles.photoThumb}
                unoptimized
              />
              <div style={{ fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 500 }}>{rejectingPhoto.caption ?? '(no caption)'}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>
                  by {rejectingPhoto.user?.username ?? '—'}
                </div>
              </div>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label
                  htmlFor="reject-reason"
                  style={{ fontSize: '0.8125rem', display: 'block', marginBottom: 4 }}
                >
                  Reason (optional, sent to the photographer)
                </label>
                <textarea
                  id="reject-reason"
                  className="input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  maxLength={REASON_MAX_LENGTH}
                  rows={4}
                  placeholder="e.g. Image is heavily blurred / duplicate of an existing photo / contains personal information"
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    textAlign: 'right',
                    marginTop: 2,
                  }}
                >
                  {rejectReason.length} / {REASON_MAX_LENGTH}
                </div>
              </div>
              {rejectError && (
                <p className="error-text" style={{ marginBottom: 12 }}>
                  {rejectError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeRejectModal}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${styles.actionBtnDanger}`}
                  disabled={rejectSubmitting}
                >
                  {rejectSubmitting ? 'Rejecting…' : 'Reject Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
