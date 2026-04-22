'use client';

import { useQuery } from 'urql';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { GET_SELLER_PROFILE, GET_SELLER_FEEDBACK } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  buyer: {
    id: string;
    username: string;
    profile: { displayName: string | null; avatarUrl: string | null } | null;
  };
  item: { id: string; title: string } | null;
}

interface SellerProfileData {
  id: string;
  bio: string | null;
  website: string | null;
  status: string;
  approved: boolean;
  averageRating: number;
  feedbackCount: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    profile: { displayName: string | null; avatarUrl: string | null; bio: string | null } | null;
  };
}

export default function SellerProfilePage() {
  const { userId } = useParams<{ userId: string }>();

  const [{ data: profileData, fetching: profileFetching }] = useQuery({
    query: GET_SELLER_PROFILE,
    variables: { userId },
    pause: !userId,
  });

  const seller: SellerProfileData | null = profileData?.sellerProfile ?? null;

  const [{ data: feedbackData, fetching: feedbackFetching }] = useQuery({
    query: GET_SELLER_FEEDBACK,
    variables: { sellerId: seller?.id },
    pause: !seller?.id,
  });

  const feedbackEdges: { cursor: string; node: FeedbackItem }[] =
    feedbackData?.sellerFeedback?.edges ?? [];

  if (profileFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.error}>Seller not found.</p>
          <Link href="/marketplace" className={styles.backLink}>← Back to marketplace</Link>
        </div>
      </div>
    );
  }

  const displayName = seller.user.profile?.displayName ?? seller.user.username;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/marketplace" className={styles.backLink}>← Back to marketplace</Link>

        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            {seller.user.profile?.avatarUrl ? (
              <img src={seller.user.profile.avatarUrl} alt={displayName} />
            ) : (
              <span className={styles.avatarPlaceholder}>
                {displayName[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.displayName}>{displayName}</h1>
            <p className={styles.username}>@{seller.user.username}</p>
            <div className={styles.rating}>
              {'★'.repeat(Math.round(seller.averageRating))}
              {'☆'.repeat(5 - Math.round(seller.averageRating))}
              <span className={styles.ratingNum}>{seller.averageRating.toFixed(1)}</span>
              <span className={styles.ratingDenom}>/ 5</span>
              <span className={styles.ratingCount}>
                · {seller.feedbackCount} review{seller.feedbackCount !== 1 ? 's' : ''}
              </span>
            </div>
            {seller.bio && <p className={styles.bio}>{seller.bio}</p>}
            {seller.website && (
              <a href={seller.website} target="_blank" rel="noopener noreferrer" className={styles.website}>
                🌐 {seller.website}
              </a>
            )}
          </div>
        </div>

        {/* Feedback List */}
        <div className={styles.feedbackSection}>
          <h2 className={styles.sectionTitle}>Reviews</h2>
          {feedbackFetching ? (
            <p className={styles.loadingSmall}>Loading reviews…</p>
          ) : feedbackEdges.length === 0 ? (
            <p className={styles.noFeedback}>No reviews yet.</p>
          ) : (
            <div className={styles.feedbackList}>
              {feedbackEdges.map(({ node: fb }) => (
                <div key={fb.id} className={styles.feedbackCard}>
                  <div className={styles.feedbackHeader}>
                    <div className={styles.feedbackReviewer}>
                      {fb.buyer.profile?.displayName ?? fb.buyer.username}
                    </div>
                    <div className={styles.feedbackStars}>
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                    </div>
                  </div>
                  {fb.comment && <p className={styles.feedbackComment}>{fb.comment}</p>}
                  {fb.item && (
                    <Link href={`/marketplace/item/${fb.item.id}`} className={styles.feedbackItem}>
                      Re: {fb.item.title}
                    </Link>
                  )}
                  <div className={styles.feedbackDate}>
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}