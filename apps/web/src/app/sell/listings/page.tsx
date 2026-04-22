'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_MY_LISTINGS } from '@/lib/queries';

import styles from './page.module.css';

interface MyListing {
  id: string;
  title: string;
  description: string | null;
  priceUsd: string;
  condition: string;
  location: string | null;
  moderationStatus: string;
  active: boolean;
  createdAt: string;
  category: { id: string; name: string; label: string };
  images: Array<{ id: string; variantType: string; url: string; width: number; height: number; sortOrder: number }>;
}

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

const STATUS_LYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending Review', className: styles.statusPending },
  approved: { label: 'Approved', className: styles.statusApproved },
  rejected: { label: 'Rejected', className: styles.statusRejected },
  review: { label: 'In Review', className: styles.statusReview },
};

function MyListingsContent() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const [{ data, fetching }] = useQuery({
    query: GET_MY_LISTINGS,
    pause: !ready || !user,
  });

  if (!ready || !user) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const edges: Array<{ cursor: string; node: MyListing }> =
    data?.myListings?.edges ?? [];
  const listings: MyListing[] = edges.map((e) => e.node);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <Link href="/settings/profile" className={styles.backLink}>← Back to settings</Link>
            <h1 className={styles.title}>My Listings</h1>
          </div>
          <Link href="/sell/listings/new" className="btn btn-primary">
            + New Listing
          </Link>
        </div>

        {fetching ? (
          <p className={styles.loading}>Loading listings…</p>
        ) : listings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <h2 className={styles.emptyTitle}>No listings yet</h2>
            <p className={styles.emptyText}>
              Create your first collectibles listing and start selling.
            </p>
            <Link href="/sell/listings/new" className="btn btn-primary">
              Create Listing
            </Link>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((item) => {
                  const thumb = item.images.find((i) => i.variantType === 'thumbnail') ?? item.images[0];
                  const status = STATUS_LYLES[item.moderationStatus] ?? { label: item.moderationStatus, className: '' };

                  return (
                    <tr key={item.id}>
                      <td>
                        {thumb ? (
                          <img src={thumb.url} alt={item.title} className={styles.thumb} />
                        ) : (
                          <div className={styles.thumbPlaceholder}>📦</div>
                        )}
                      </td>
                      <td className={styles.titleCell}>
                        <Link href={`/marketplace/item/${item.id}`} className={styles.itemTitle}>
                          {item.title}
                        </Link>
                        <span className={styles.condition}>
                          {CONDITION_LABELS[item.condition] ?? item.condition}
                        </span>
                      </td>
                      <td className={styles.categoryCell}>{item.category.label}</td>
                      <td className={styles.priceCell}>${item.priceUsd}</td>
                      <td>
                        <span className={`${styles.status} ${status.className}`}>
                          {status.label}
                          {item.active && item.moderationStatus === 'approved' && (
                            <span className={styles.activeDot}> 🟢</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/marketplace/item/${item.id}`}>View</Link>
                          <Link href={`/sell/listings/${item.id}/edit`}>Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyListingsPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.inner}><p className={styles.loading}>Loading…</p></div></div>}>
      <MyListingsContent />
    </Suspense>
  );
}