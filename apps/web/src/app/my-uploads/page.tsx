'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { MY_UPLOADS } from '@/lib/queries';
import { Pagination } from '@/components/Pagination';
import styles from './page.module.css';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending Review', className: styles.statusPending },
  approved: { label: 'Approved', className: styles.statusApproved },
  rejected: { label: 'Rejected', className: styles.statusRejected },
  review: { label: 'Needs Review', className: styles.statusReview },
};

interface PhotoVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

interface MyUploadEdge {
  cursor: string;
  node: {
    id: string;
    caption: string | null;
    originalUrl: string;
    moderationStatus: string;
    createdAt: string;
    variants: PhotoVariant[];
    aircraft: {
      registration: string | null;
      variant: { name: string } | null;
    } | null;
  };
  queuePosition: number | null;
}

function thumbUrl(variants: PhotoVariant[], originalUrl: string): string {
  const variant = variants.find((v) => v.variantType === 'thumbnail');
  return variant?.url ?? originalUrl;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function MyUploadsPage() {
  const { user, ready } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [{ data, fetching }] = useQuery({
    query: MY_UPLOADS,
    variables: {
      moderationStatus: statusFilter || undefined,
      first: PAGE_SIZE,
      page: currentPage,
    },
    pause: !ready || !user,
    requestPolicy: 'cache-and-network',
  });

  if (!ready) return <div className={styles.page}><p className={styles.loading}>Loading…</p></div>;
  if (!user) return <div className={styles.page}><p className={styles.denied}>Please sign in to view your uploads.</p></div>;

  const uploads = data?.myUploads;
  const edges: MyUploadEdge[] = uploads?.edges ?? [];
  const totalCount = uploads?.totalCount ?? 0;
  const totalPendingCount = uploads?.totalPendingCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.headerRow}>
          <h1 className={styles.title}>My Uploads</h1>
          <Link href="/upload" className="btn btn-primary">
            Upload Photo
          </Link>
        </div>

        {totalPendingCount > 0 && (
          <div className={styles.queueInfo}>
            <span className={styles.queueIcon}>⏳</span>
            <span>
              There {totalPendingCount === 1 ? 'is' : 'are'}{' '}
              <strong>{totalPendingCount}</strong> photo{totalPendingCount !== 1 ? 's' : ''} in the
              review queue.
            </span>
          </div>
        )}

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
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="review">Needs Review</option>
          </select>
        </div>

        {fetching && edges.length === 0 && <p className={styles.loading}>Loading your uploads…</p>}

        {!fetching && edges.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              {statusFilter
                ? 'No uploads match this filter.'
                : "You haven't uploaded any photos yet."}
            </p>
            <Link href="/upload" className="btn btn-primary">
              Upload your first photo
            </Link>
          </div>
        )}

        {edges.length > 0 && (
          <div className={styles.grid}>
            {edges.map((edge) => {
              const photo = edge.node;
              const status = STATUS_LABELS[photo.moderationStatus] ?? {
                label: photo.moderationStatus,
                className: '',
              };

              return (
                <Link
                  key={photo.id}
                  href={`/photos/${photo.id}`}
                  className={styles.card}
                >
                  <div className={styles.imageWrap}>
                    <Image
                      src={thumbUrl(photo.variants, photo.originalUrl)}
                      alt={photo.caption || 'Photo'}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className={styles.image}
                    />
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={`${styles.statusBadge} ${status.className}`}>
                        {status.label}
                      </span>
                      <span className={styles.time}>{relativeTime(photo.createdAt)}</span>
                    </div>

                    {photo.caption && (
                      <p className={styles.caption}>{photo.caption}</p>
                    )}

                    {photo.aircraft && (
                      <p className={styles.aircraft}>
                        {photo.aircraft.registration}
                        {photo.aircraft.variant && ` · ${photo.aircraft.variant.name}`}
                      </p>
                    )}

                    {edge.queuePosition !== null && (
                      <div className={styles.queuePosition}>
                        <span className={styles.queuePositionIcon}>📋</span>
                        <span>
                          Position <strong>#{edge.queuePosition}</strong> of{' '}
                          {totalPendingCount} in queue
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
