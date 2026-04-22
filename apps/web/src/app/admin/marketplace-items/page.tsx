'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_ADMIN_MARKETPLACE_ITEMS, MODERATE_MARKETPLACE_ITEM } from '@/lib/queries';

import styles from './page.module.css';

interface AdminItem {
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
  seller: {
    id: string;
    user: {
      id: string;
      username: string;
      email: string;
      profile: { displayName: string | null };
    };
  };
  images: Array<{ id: string; url: string; variantType: string }>;
}

const STATUS_OPTIONS = ['', 'pending', 'approved', 'rejected', 'review'];

function AdminMarketplaceItemsContent() {
  const { user, ready } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending');

  const [{ data, fetching, error }] = useQuery({
    query: GET_ADMIN_MARKETPLACE_ITEMS,
    variables: {
      moderationStatus: statusFilter || undefined,
      first: 50,
    },
    pause: !ready || !user,
  });

  const [, moderateMutation] = useMutation(MODERATE_MARKETPLACE_ITEM);

  if (!ready || !user) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const edges: Array<{ cursor: string; node: AdminItem }> =
    data?.adminMarketplaceItems?.edges ?? [];
  const items: AdminItem[] = edges.map((e) => e.node);

  const handleModerate = async (id: string, status: string, reason?: string) => {
    await moderateMutation({ id, status, reason: reason || undefined });
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <Link href="/admin" className={styles.backLink}>← Admin</Link>
            <h1 className={styles.title}>Marketplace Moderation</h1>
            <p className={styles.subtitle}>Review and approve or reject collectibles listings.</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className={styles.tabs}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              className={`${styles.tab} ${statusFilter === s ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(s)}
              type="button"
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {fetching ? (
          <p className={styles.loading}>Loading…</p>
        ) : error ? (
          <p className={styles.errorMsg}>Failed to load items.</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>No items with status "{statusFilter || 'all'}"</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Title</th>
                  <th>Seller</th>
                  <th>Price</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const thumb = item.images.find((i) => i.variantType === 'thumbnail') ?? item.images[0];
                  return (
                    <tr key={item.id}>
                      <td>
                        {thumb ? (
                          <img src={thumb.url} alt="" className={styles.thumb} />
                        ) : (
                          <div className={styles.thumbPlaceholder}>📦</div>
                        )}
                      </td>
                      <td>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.category}>{item.category.label}</span>
                      </td>
                      <td>
                        <div className={styles.sellerInfo}>
                          <span>{item.seller.user.username}</span>
                          <span className={styles.sellerEmail}>{item.seller.user.email}</span>
                        </div>
                      </td>
                      <td className={styles.price}>${item.priceUsd}</td>
                      <td className={styles.condition}>{item.condition}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status${item.moderationStatus.charAt(0).toUpperCase() + item.moderationStatus.slice(1)}`]}`}>
                          {item.moderationStatus}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.approveBtn}
                            onClick={() => handleModerate(item.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={styles.rejectBtn}
                            onClick={() => handleModerate(item.id, 'rejected')}
                          >
                            Reject
                          </button>
                          <Link href={`/marketplace/item/${item.id}`} target="_blank" className={styles.viewLink}>
                            View
                          </Link>
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

export default function AdminMarketplaceItemsPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.inner}><p className={styles.loading}>Loading…</p></div></div>}>
      <AdminMarketplaceItemsContent />
    </Suspense>
  );
}