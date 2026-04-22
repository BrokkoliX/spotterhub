'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/lib/auth';
import {
  GET_ME,
  APPLY_TO_SELL,
  MY_SALES,
  GET_PHOTOS,
} from '@/lib/queries';

import styles from './page.module.css';

interface PhotoData {
  id: string;
  caption?: string | null;
  originalUrl: string;
  variants: Array<{ variantType: string; url: string; width: number; height: number }>;
}

interface MyPhotoData extends PhotoData {
  listing?: { id: string; priceUsd: string; active: boolean } | null;
}

export default function SellerSettingsPage() {
  const { user, ready } = useAuth();
  const searchParams = useSearchParams();
  const [applied, setApplied] = useState(false);

  // Query user photos for listing management
  const [{ data: photosData, fetching: photosFetching }] = useQuery({
    query: GET_PHOTOS,
    variables: { userId: user?.id },
    pause: !ready || !user,
  });

  // Query for my sales
  const [{ data: salesData }] = useQuery({
    query: MY_SALES,
    pause: !ready || !user,
  });

  // Determine seller state from GET_ME + sellerProfile
  const [{ data: meData, fetching: meFetching }] = useQuery({
    query: GET_ME,
    pause: !ready || !user,
  });

  const sellerProfile = meData?.me?.sellerProfile;
  const isApproved = sellerProfile?.approved === true;
  const onboardingComplete = sellerProfile?.stripeOnboardingComplete === true;
  const hasStripeAccount = !!sellerProfile?.stripeAccountId;

  // Handle onboarding return params
  useEffect(() => {
    const status = searchParams.get('onboarding');
    if (status === 'complete' && sellerProfile) {
      // Stripe onboarding complete — could refresh seller profile here
    }
  }, [searchParams, sellerProfile]);

  // Apply mutation
  const [{ fetching: applying }, applyToSell] = useMutation(APPLY_TO_SELL);
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!bio.trim()) {
      setApplyError('Please write a short bio');
      return;
    }
    setApplyError(null);
    const result = await applyToSell({
      input: { bio: bio.trim(), website: website.trim() || undefined },
    });
    if (result.error) {
      setApplyError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to apply');
    } else {
      setApplied(true);
    }
  };

  // My photos that could be listed (approved photos with no active listing)
  const myPhotos: MyPhotoData[] = (photosData?.photos?.edges ?? []).map(
    (e: { node: MyPhotoData }) => e.node,
  );
  const myListedPhotos = myPhotos.filter((p) => p.listing?.active);

  // Sales counts
  const salesEdges = salesData?.mySales?.edges ?? [];
  const totalSales = salesEdges.filter(
    (s: { node: { status: string } }) => s.node.status === 'completed',
  ).length;
  const pendingSales = salesEdges
    .filter((s: { node: { status: string } }) => s.node.status === 'pending')
    .length;

  if (!ready || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Not a seller ────────────────────────────────────────────────────────
  if (!sellerProfile && !meFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <a href="/settings/profile" className={styles.backLink}>
            ← Back to settings
          </a>
          <h1 className={styles.title}>Seller Dashboard</h1>
          <p className={styles.subtitle}>Start selling your aviation photography</p>

          <div className={`${styles.card} ${styles.applyCard}`}>
            <h2 className={styles.applyTitle}>Become a Seller</h2>
            <p className={styles.applyText}>
              Apply to start listing your photos for sale. Approved sellers can
              price their approved photos and receive payments via Stripe.
            </p>
            <textarea
              className={styles.bioTextarea}
              placeholder="Tell buyers about yourself and your photography…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
            <input
              type="url"
              className={styles.websiteInput}
              placeholder="Optional website URL"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            {applyError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: 12 }}>{applyError}</p>
            )}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleApply}
              disabled={applying}
              type="button"
            >
              {applying ? 'Submitting…' : 'Apply to Sell'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Applied, pending approval ──────────────────────────────────────────
  if (sellerProfile && !isApproved && !meFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <a href="/settings/profile" className={styles.backLink}>
            ← Back to settings
          </a>
          <h1 className={styles.title}>Seller Dashboard</h1>
          <p className={styles.subtitle}>Your application is under review</p>

          <div className={`${styles.card} ${styles.pendingCard}`}>
            <div className={styles.pendingIcon}>⏳</div>
            <h2 className={styles.pendingTitle}>Application Pending</h2>
            <p className={styles.pendingText}>
              Your seller application is being reviewed by our team. You'll be
              notified once approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Approved — need Stripe onboarding ──────────────────────────────────
  if (isApproved && !onboardingComplete && hasStripeAccount && !meFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <a href="/settings/profile" className={styles.backLink}>
            ← Back to settings
          </a>
          <h1 className={styles.title}>Seller Dashboard</h1>
          <p className={styles.subtitle}>Complete your Stripe setup to start receiving payments</p>

          <div className={`${styles.card} ${styles.onboardingCard}`}>
            <h2 className={styles.onboardingTitle}>Complete Your Stripe Account</h2>
            <p className={styles.onboardingText}>
              You need to complete your Stripe onboarding before you can receive
              payments. Click below to finish setup.
            </p>
            <a
              href={`/settings/seller?onboarding=start`}
              className={styles.onboardingBtn}
            >
              Continue to Stripe Setup →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Fully approved seller ──────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <a href="/settings/profile" className={styles.backLink}>
          ← Back to settings
        </a>
        <h1 className={styles.title}>Seller Dashboard</h1>
        <p className={styles.subtitle}>Manage your listings and view your sales</p>

        {/* Sales Summary */}
        <div className={styles.salesSummary}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Total Sales</div>
            <div className={`${styles.summaryValue} ${totalSales > 0 ? styles.positive : ''}`}>
              {totalSales}
            </div>
          </div>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Pending</div>
            <div className={styles.summaryValue}>{pendingSales}</div>
          </div>
          <div className={styles.summaryStat}>
            <div className={styles.summaryLabel}>Active Listings</div>
            <div className={`${styles.summaryValue} ${styles.positive}`}>
              {myListedPhotos.length}
            </div>
          </div>
        </div>

        {/* Listings Table */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your Listings</h2>
          {photosFetching ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Loading photos…</p>
          ) : myPhotos.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>
              No approved photos yet. Upload and get photos approved to start selling.
            </p>
          ) : (
            <table className={styles.listingsTable}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Caption</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myPhotos.map((photo) => {
                  const thumb = photo.variants?.find(
                    (v: { variantType: string }) => v.variantType === 'thumbnail',
                  );
                  const imgUrl = thumb?.url ?? photo.originalUrl;
                  return (
                    <tr key={photo.id}>
                      <td>
                        <img
                          src={imgUrl}
                          alt={photo.caption ?? ''}
                          className={styles.listingThumb}
                        />
                      </td>
                      <td className={styles.listingCaption}>
                        {photo.caption ?? '—'}
                      </td>
                      <td>
                        <span
                          className={`${styles.listingActive} ${
                            photo.listing?.active ? styles.active : styles.inactive
                          }`}
                        >
                          {photo.listing?.active ? '🟢 Active' : '⚪ Inactive'}
                        </span>
                      </td>
                      <td className={styles.listingPrice}>
                        {photo.listing?.priceUsd ? `$${photo.listing.priceUsd}` : '—'}
                      </td>
                      <td>
                        <div className={styles.listingActions}>
                          <a href={`/photos/${photo.id}`}>View</a>
                          {photo.listing?.active ? (
                            <a href={`/photos/${photo.id}?listing=edit`}>Edit</a>
                          ) : (
                            <button type="button">List for $</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}