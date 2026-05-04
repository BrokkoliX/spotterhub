'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { ADMIN_SELLER_APPLICATIONS, APPROVE_SELLER } from '@/lib/queries';

import styles from './page.module.css';

export default function AdminSellersPage() {
  const [{ data, fetching }] = useQuery({
    query: ADMIN_SELLER_APPLICATIONS,
    variables: { first: 50 },
  });

  const [{ fetching: approving }, approveSeller] = useMutation(APPROVE_SELLER);
  const [processed, setProcessed] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);

  const applications = data?.adminSellerApplications?.edges ?? [];

  const handleApprove = async (sellerProfileId: string) => {
    setProcessingId(sellerProfileId);
    try {
      const result = await approveSeller({ sellerProfileId });
      if (result.data?.approveSeller?.onboardingUrl) {
        const confirmCopy = window.confirm('Seller approved. Stripe onboarding link:\n' + result.data.approveSeller.onboardingUrl + '\n\nClick OK to open Stripe onboarding, or Cancel to copy the link manually.');
        if (confirmCopy) {
          window.open(result.data.approveSeller.onboardingUrl, '_blank');
        }
      }
      setProcessed((p) => new Set([...p, sellerProfileId]));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <a href="/admin" className={styles.backLink}>
          ← Back to admin
        </a>
        <h1 className={styles.title}>Seller Applications</h1>
        <p className={styles.subtitle}>Review and approve seller applications</p>

        {fetching ? (
          <p className={styles.loading}>Loading…</p>
        ) : applications.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📋</div>
            <p className={styles.emptyTitle}>No pending applications</p>
            <p className={styles.emptyText}>All seller applications have been processed.</p>
          </div>
        ) : (
          <div className={styles.applicationList}>
            {applications.map(({ node }: { node: { id: string; status?: string; bio?: string | null; website?: string | null; approved: boolean; stripeOnboardingComplete: boolean; createdAt: string; user: { username: string; email: string; profile?: { displayName?: string | null; avatarUrl?: string | null } | null } } }) => (
              <div key={node.id} className={styles.applicationCard}>
                <div className={styles.applicant}>
                  <div className={styles.applicantAvatar}>
                    {node.user.profile?.avatarUrl ? (
                      <img src={node.user.profile?.avatarUrl} alt={node.user.username} />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <div className={styles.applicantInfo}>
                    <div className={styles.applicantName}>
                      {node.user.profile?.displayName ?? node.user.username}
                    </div>
                    <div className={styles.applicantMeta}>
                      @{node.user.username} · {node.user.email} · Applied {new Date(node.createdAt).toLocaleDateString()}
                      {node.status && <span> · status={node.status}</span>}
                    </div>
                  </div>
                </div>

                {node.bio && (
                  <p className={styles.bio}>{node.bio}</p>
                )}

                {node.website && (
                  <p className={styles.website}>
                    <a href={node.website} target="_blank" rel="noopener noreferrer">
                      🌐 {node.website}
                    </a>
                  </p>
                )}

                <div className={styles.applicationStatus}>
                  {node.approved ? (
                    <span className={styles.statusApproved}>✅ Approved</span>
                  ) : processed.has(node.id) || node.approved ? (
                    <span className={styles.statusApproved}>✅ Approved</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(node.id)}
                      disabled={processingId === node.id || approving}
                      type="button"
                    >
                      {processingId === node.id ? 'Approving…' : 'Approve Seller'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
