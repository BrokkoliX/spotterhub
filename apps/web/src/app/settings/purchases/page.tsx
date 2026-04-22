'use client';

import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { MY_PURCHASES } from '@/lib/queries';

import styles from './page.module.css';

export default function PurchasesPage() {
  const { user, ready } = useAuth();

  const [{ data, fetching }] = useQuery({
    query: MY_PURCHASES,
    pause: !ready || !user,
    variables: { first: 50 },
  });

  const purchases = data?.myPurchases?.edges ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <a href="/settings/profile" className={styles.backLink}>
          ← Back to settings
        </a>
        <h1 className={styles.title}>Your Purchases</h1>
        <p className={styles.subtitle}>Photos you have purchased</p>

        {fetching ? (
          <p className={styles.loading}>Loading…</p>
        ) : purchases.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <p className={styles.emptyTitle}>No purchases yet</p>
            <p className={styles.emptyText}>
              When you buy a photo, it will appear here.
            </p>
            <a href="/marketplace" className="btn btn-primary" style={{ marginTop: 16 }}>
              Browse Marketplace
            </a>
          </div>
        ) : (
          <div className={styles.purchaseList}>
            {purchases.map(({ node }: { node: { id: string; amountUsd: string; createdAt: string; photo: { id: string; caption?: string | null; originalUrl: string; variants: Array<{ variantType: string; url: string; width: number; height: number }> }; seller: { username: string; profile?: { displayName?: string | null } | null } } }) => {
              const thumb = node.photo.variants?.find(
                (v: { variantType: string }) => v.variantType === 'thumbnail',
              );
              const imgUrl = thumb?.url ?? node.photo.originalUrl;
              const date = new Date(node.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              });
              return (
                <div key={node.id} className={styles.purchaseCard}>
                  <a href={`/photos/${node.photo.id}`} className={styles.purchaseThumb}>
                    <img src={imgUrl} alt={node.photo.caption ?? ''} />
                  </a>
                  <div className={styles.purchaseInfo}>
                    <a href={`/photos/${node.photo.id}`} className={styles.purchaseCaption}>
                      {node.photo.caption ?? 'Untitled'}
                    </a>
                    <p className={styles.purchaseMeta}>
                      From @{node.seller.username} · {date}
                    </p>
                  </div>
                  <div className={styles.purchaseAmount}>
                    ${node.amountUsd}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}