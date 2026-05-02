'use client';

import { useQuery } from 'urql';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { GET_MARKETPLACE_ITEM, GET_MARKETPLACE_ITEM as GET_SIMILAR_ITEMS } from '@/lib/queries';
import { ReportButton } from '@/components/ReportButton';

import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemImage {
  id: string;
  variantType: string;
  url: string;
  width: number;
  height: number;
  fileSizeBytes: number | null;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  label: string;
}

interface SellerUser {
  id: string;
  username: string;
  profile: { displayName: string | null; avatarUrl: string | null } | null;
}

interface Seller {
  id: string;
  bio: string | null;
  website: string | null;
  averageRating: number;
  feedbackCount: number;
  user: SellerUser;
}

interface MarketplaceItem {
  id: string;
  title: string;
  description: string | null;
  priceUsd: string;
  condition: string;
  location: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  active: boolean;
  averageRating: number;
  feedbackCount: number;
  createdAt: string;
  updatedAt: string;
  category: Category;
  images: ItemImage[];
  seller: Seller;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const fullStars = Math.round(rating);
  return (
    <span className={styles.stars}>
      {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
      <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
      <span className={styles.ratingCount}>({count} review{count !== 1 ? 's' : ''})</span>
    </span>
  );
}

// ─── Condition Badge ─────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`${styles.conditionBadge} ${styles[`condition${condition.charAt(0).toUpperCase() + condition.slice(1)}`]}`}>
      {CONDITION_LABELS[condition] ?? condition}
    </span>
  );
}

// ─── Image Gallery ───────────────────────────────────────────────────────────

function ImageGallery({ images }: { images: ItemImage[] }) {
  const displayImage = images.find((i) => i.variantType === 'display') ?? images[0];
  const thumbnailImages = images.filter((i) => i.variantType === 'thumbnail' || i.variantType === 'full_res');

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        {displayImage ? (
          <img src={displayImage.url} alt="Item" className={styles.galleryMainImg} />
        ) : (
          <div className={styles.galleryPlaceholder}>No image</div>
        )}
      </div>
      {thumbnailImages.length > 0 && (
        <div className={styles.galleryThumbs}>
          {thumbnailImages.map((img) => (
            <button key={img.id} type="button" className={styles.galleryThumb}>
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seller Card ─────────────────────────────────────────────────────────────

function SellerCard({ seller }: { seller: Seller }) {
  return (
    <div className={styles.sellerCard}>
      <div className={styles.sellerAvatar}>
        {seller.user.profile?.avatarUrl ? (
          <img src={seller.user.profile.avatarUrl} alt={seller.user.username} />
        ) : (
          <span className={styles.sellerAvatarPlaceholder}>
            {seller.user.profile?.displayName?.[0] ?? seller.user.username[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className={styles.sellerInfo}>
        <div className={styles.sellerName}>
          {seller.user.profile?.displayName ?? seller.user.username}
        </div>
        <StarRating rating={seller.averageRating} count={seller.feedbackCount} />
        {seller.bio && <p className={styles.sellerBio}>{seller.bio}</p>}
        {seller.website && (
          <a href={seller.website} target="_blank" rel="noopener noreferrer" className={styles.sellerWebsite}>
            🌐 {seller.website}
          </a>
        )}
        <Link href={`/marketplace/seller/${seller.user.id}`} className={styles.sellerProfileLink}>
          View seller profile →
        </Link>
      </div>
    </div>
  );
}

// ─── Contact Section ─────────────────────────────────────────────────────────

function ContactSection({ item }: { item: MarketplaceItem }) {
  if (!item.contactEmail && !item.contactPhone) return null;

  return (
    <div className={styles.contactSection}>
      <h3 className={styles.contactTitle}>Contact Seller</h3>
      {item.contactEmail && (
        <div className={styles.contactRow}>
          <span className={styles.contactLabel}>📧 Email:</span>
          <a href={`mailto:${item.contactEmail}`} className={styles.contactValue}>{item.contactEmail}</a>
        </div>
      )}
      {item.contactPhone && (
        <div className={styles.contactRow}>
          <span className={styles.contactLabel}>📞 Phone:</span>
          <span className={styles.contactValue}>{item.contactPhone}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MarketplaceItemPage() {
  const { id } = useParams<{ id: string }>();

  const [{ data, fetching, error }] = useQuery({
    query: GET_MARKETPLACE_ITEM,
    variables: { id },
    pause: !id,
  });

  const item: MarketplaceItem | null = data?.marketplaceItem ?? null;

  if (fetching) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.error}>Item not found or failed to load.</p>
          <Link href="/marketplace" className={styles.backLink}>← Back to marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/marketplace" className={styles.backLink}>← Back to marketplace</Link>

        <div className={styles.layout}>
          {/* Left: Images */}
          <div className={styles.imageCol}>
            <ImageGallery images={item.images} />
          </div>

          {/* Right: Details */}
          <div className={styles.detailCol}>
            <div className={styles.categoryBreadcrumb}>
              {item.category.label}
            </div>

            <h1 className={styles.title}>{item.title}</h1>

            <div className={styles.priceRow}>
              <span className={styles.price}>${item.priceUsd}</span>
              <ConditionBadge condition={item.condition} />
            </div>

            <StarRating rating={item.averageRating} count={item.feedbackCount} />

            {item.location && (
              <div className={styles.locationRow}>
                <span className={styles.locationLabel}>📍</span>
                <span>{item.location}</span>
              </div>
            )}

            {item.description && (
              <div className={styles.descriptionSection}>
                <h3 className={styles.sectionTitle}>Description</h3>
                <p className={styles.description}>{item.description}</p>
              </div>
            )}

            <SellerCard seller={item.seller} />

            <ContactSection item={item} />

            <div className={styles.feedbackPrompt}>
              <Link href={`/marketplace/seller/${item.seller.user.id}`} className={styles.feedbackLink}>
                ★ Leave feedback for this seller
              </Link>
            </div>

            <div className={styles.reportRow}>
              <ReportButton targetType="marketplace_item" targetId={item.id} />
            </div>

            {item.moderationStatus === 'pending' && (
              <div className={styles.pendingNotice}>
                ⚠️ This listing is pending review and not visible to buyers yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}