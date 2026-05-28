'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, use, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { AdBanner } from '@/components/AdBanner';
import { AdminChoiceButton } from '@/components/AdminChoiceButton';
import { CommentSection } from '@/components/CommentSection';
import { FollowButton } from '@/components/FollowButton';
import { LikeButton } from '@/components/LikeButton';
import { ReportButton } from '@/components/ReportButton';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import {
  GET_PHOTO,
  DELETE_PHOTO,
  CREATE_PHOTO_PURCHASE,
  GET_AD_SETTINGS,
  APPROVE_PHOTO,
  REJECT_PHOTO,
} from '@/lib/queries';

import styles from './page.module.css';

interface PhotoVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

export default function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className="container">
            <p className={styles.loading}>Loading…</p>
          </div>
        </div>
      }
    >
      <PhotoDetailInner params={params} />
    </Suspense>
  );
}

function PhotoDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const { user, ready } = useAuth();
  const router = useRouter();
  const [result] = useQuery({ query: GET_PHOTO, variables: { id } });
  const [{ data: adData }] = useQuery({ query: GET_AD_SETTINGS });
  const { data, fetching, error } = result;
  const [{ fetching: deleting }, deletePhoto] = useMutation(DELETE_PHOTO);
  const [{ fetching: approving }, approvePhoto] = useMutation(APPROVE_PHOTO);
  const [{ fetching: rejecting }, rejectPhoto] = useMutation(REJECT_PHOTO);
  const [imgError, setImgError] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isOwner = ready && user?.id === data?.photo?.user?.id;
  const isPrivileged =
    ready && (user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'superuser');
  const canDelete = isOwner || isPrivileged;
  const canEdit = isOwner || isPrivileged;

  const handleDelete = async () => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    const res = await deletePhoto({ photoId: id });
    if (res.data?.deletePhoto) {
      router.push(returnTo);
    }
  };

  const handleApprove = async () => {
    await approvePhoto({ photoId: id });
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    await rejectPhoto({ photoId: id, reason: rejectReason.trim() || undefined });
    setShowRejectModal(false);
    setRejectReason('');
  };

  // Marketplace purchase
  const [{ fetching: purchasing }, createPurchase] = useMutation(CREATE_PHOTO_PURCHASE);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen && e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (fetching) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.photo) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.notFound}>
            <div className={styles.notFoundIcon}>🔍</div>
            <p>Photo not found</p>
            <Link href="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
              Back to feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photo = data.photo;
  const exif = photo.exifData as Record<string, unknown> | null;
  const watermarkedVariant = photo.watermarkEnabled
    ? photo.variants.find((v: PhotoVariant) => v.variantType === 'watermarked')
    : undefined;
  const displayVariant = photo.variants.find((v: PhotoVariant) => v.variantType === 'display');
  const imageUrl = watermarkedVariant?.url ?? displayVariant?.url ?? photo.originalUrl;
  const displayName = photo.user.profile?.displayName ?? photo.user.username;
  // Use the user's browser locale (pass `undefined`) so EU users see
  // dd/mm/yyyy and US users see mm/dd/yyyy without us having to pick a side.
  const uploadDate = new Date(photo.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const canBuy = !isOwner && photo.listing?.active;
  const listingPrice = photo.listing?.priceUsd;

  const handleBuy = async () => {
    if (!photo.listing?.id) return;
    setPurchaseError(null);
    const result = await createPurchase({ listingId: photo.listing.id });
    if (result.error) {
      setPurchaseError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to start purchase');
    } else if (result.data?.createPhotoPurchase?.checkoutUrl) {
      window.location.href = result.data.createPhotoPurchase.checkoutUrl;
    }
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <Link href={returnTo} className={styles.backLink}>
          ← Back
        </Link>

        <div className={styles.layout}>
          {/* Main column — wraps everything that lives in the left column
              of the .layout grid so the photo, ads, buy card and the
              "More from this aircraft" strip stack together as one grid
              child, independent of the sidebar's height. Moderation banners
              and admin tools also live here so they don't accidentally
              hijack the grid's column-1 slot from the image. */}
          <div className={styles.mainColumn}>
            {/* Moderation banner — visible to the owner and to moderators/admins.
                The backend's rejectionReason resolver already enforces this
                authorization, so we conservatively gate the banner here too. */}
            {(isOwner || isPrivileged) && photo.moderationStatus === 'pending' && (
              <div
                className={`${styles.moderationBanner} ${styles.moderationBannerPending}`}
                role="status"
              >
                <span className={styles.moderationBannerTitle}>⏳ Awaiting moderation</span>
                <span className={styles.moderationBannerBody}>
                  This photo is pending review by a moderator. It is not yet visible in the public
                  feed.
                </span>
                {isPrivileged && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      className={styles.moderationBtnApprove}
                      onClick={handleApprove}
                      disabled={approving}
                    >
                      {approving ? 'Approving…' : '✓ Approve'}
                    </button>
                    <button
                      className={styles.moderationBtnReject}
                      onClick={() => setShowRejectModal(true)}
                      disabled={rejecting}
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {(isOwner || isPrivileged) && photo.moderationStatus === 'rejected' && (
              <div
                className={`${styles.moderationBanner} ${styles.moderationBannerRejected}`}
                role="status"
              >
                <span className={styles.moderationBannerTitle}>🚫 Photo rejected</span>
                <span className={styles.moderationBannerBody}>
                  {photo.rejectionReason
                    ? `Reason: ${photo.rejectionReason}`
                    : 'A moderator rejected this photo. No reason was provided.'}
                </span>
              </div>
            )}

            {/* Admin tools — superuser-only, on approved photos.
                The component itself hides if the admin-choice-week badge
                is missing or inactive, so it's safe to mount here. */}
            {ready && user?.role === 'superuser' && photo.moderationStatus === 'approved' && (
              <AdminChoiceButton
                photoId={photo.id}
                uploaderId={photo.user.id}
                uploaderUsername={photo.user.username}
              />
            )}
            {/* Image */}
            <div
              className={`${styles.imageContainer} ${isFullscreen ? styles.fullscreenImageContainer : ''}`}
            >
              {imageUrl && !imgError ? (
                <img
                  src={imageUrl}
                  alt={photo.caption ?? `Photo by ${displayName}`}
                  className={`${styles.image} ${isFullscreen ? styles.fullscreenImage : ''}`}
                  onError={() => setImgError(true)}
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <div className={styles.imagePlaceholder}>📷</div>
              )}
            </div>

            {/* Ad after image */}
            {adData?.adSettings?.slotPhotoDetail && (
              <AdBanner slotId={adData.adSettings.slotPhotoDetail} />
            )}

            {/* Buy Button (for priced photos not owned by viewer) */}
            {canBuy && listingPrice && (
              <div className={styles.buyCard}>
                <div className={styles.buyPrice}>${listingPrice}</div>
                <div className={styles.buyLabel}>for a high-resolution license</div>
                <button
                  className={styles.buyBtn}
                  onClick={handleBuy}
                  disabled={purchasing}
                  type="button"
                >
                  {purchasing ? 'Redirecting to Stripe…' : `Buy this photo — $${listingPrice}`}
                </button>
                {purchaseError && <p className={styles.buyError}>{purchaseError}</p>}
                <p className={styles.buyNote}>
                  Secure payment via Stripe · Seller receives most of the amount
                </p>
              </div>
            )}

            {/* Owner listing badge */}
            {isOwner && photo.listing?.active && (
              <div className={styles.listedBadge}>📋 Listed for ${photo.listing.priceUsd}</div>
            )}

            {/* More from this aircraft — sits directly below the main image
                inside this column. Width matches the photo column; the
                sidebar to the right remains in its own grid column. */}
            {photo.similarAircraftPhotos && photo.similarAircraftPhotos.edges.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>✈️ More from this aircraft / Airport</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  {photo.similarAircraftPhotos.edges.map(
                    ({
                      node: similar,
                    }: {
                      node: {
                        id: string;
                        variants?: {
                          variantType: string;
                          url: string;
                          width: number;
                          height: number;
                        }[];
                        aircraft?: {
                          registration: string;
                          manufacturer?: { name: string } | null;
                          family?: { name: string } | null;
                          variant?: { name: string } | null;
                        } | null;
                        user?: { username: string } | null;
                      };
                    }) => (
                      <Link
                        key={similar.id}
                        href={`/photos/${similar.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div
                          style={{
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                            <img
                              src={
                                similar.variants?.find((v) => v.variantType === 'thumbnail_16x9')
                                  ?.url ??
                                similar.variants?.find((v) => v.variantType === 'display')?.url ??
                                similar.variants?.find((v) => v.variantType === 'thumbnail')?.url ??
                                similar.variants?.[0]?.url ??
                                ''
                              }
                              alt=""
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ padding: '8px 10px', fontSize: '0.8125rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {similar.aircraft?.registration ?? '—'}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)' }}>
                              {[
                                similar.aircraft?.manufacturer?.name,
                                similar.aircraft?.family?.name,
                                similar.aircraft?.variant?.name,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            {/* User */}
            <div className={styles.card}>
              <div className={styles.userRow}>
                <Link href={`/u/${photo.user.username}/photos`} className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {photo.user.profile?.avatarUrl ? (
                      <img
                        src={photo.user.profile.avatarUrl}
                        alt={displayName}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <div className={styles.userDetails}>
                    <div className={styles.displayName}>{displayName}</div>
                    <div className={styles.username}>@{photo.user.username}</div>
                  </div>
                </Link>
                {user?.id !== photo.user.id && (
                  <FollowButton
                    userId={photo.user.id}
                    initialIsFollowing={photo.user.isFollowedByMe ?? false}
                  />
                )}
              </div>
            </div>

            {/* Caption */}
            {photo.caption && (
              <div className={styles.card}>
                <p className={styles.caption}>{photo.caption}</p>
              </div>
            )}

            {/* Actions: like, comment, report, delete */}
            <div className={styles.card}>
              <div className={styles.stats}>
                <LikeButton
                  photoId={photo.id}
                  initialLikeCount={photo.likeCount}
                  initialIsLiked={photo.isLikedByMe}
                />
                <span className={styles.stat}>💬 {photo.commentCount}</span>
                <ReportButton targetType="photo" targetId={photo.id} />
                {canEdit && (
                  <Link
                    href={`/photos/${photo.id}/edit`}
                    className={styles.deleteBtn}
                    title="Edit photo"
                  >
                    ✏️ Edit
                  </Link>
                )}
                {canDelete && (
                  <button
                    className={styles.deleteBtn}
                    onClick={handleDelete}
                    disabled={deleting}
                    title="Delete photo"
                  >
                    🗑️ {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Details</h3>
              {photo.kind === 'COMMUNITY' ? (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 12,
                  }}
                >
                  Community photo
                  {photo.communityCategory
                    ? ` · ${photo.communityCategory.charAt(0) + photo.communityCategory.slice(1).toLowerCase()}`
                    : ''}
                </p>
              ) : !photo.aircraft ? (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 12,
                  }}
                >
                  This photo was uploaded with aircraft details that are pending admin approval.
                </p>
              ) : null}
              <ul className={styles.metaList}>
                {!photo.aircraft && photo.operatorIcao && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Operator</span>
                    <span className={styles.metaValue}>{photo.operatorIcao}</span>
                    {user && (
                      <TopicFollowButton
                        targetType="airline"
                        value={photo.operatorIcao}
                        initialIsFollowing={false}
                      />
                    )}
                  </li>
                )}
                {!photo.aircraft && photo.operatorType && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Operator Type</span>
                    <span className={styles.metaValue}>
                      {photo.operatorType
                        .toLowerCase()
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                  </li>
                )}
                {!photo.aircraft && photo.msn && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>MSN</span>
                    <span className={styles.metaValue}>{photo.msn}</span>
                  </li>
                )}
                {!photo.aircraft && photo.manufacturingDate && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Built</span>
                    <span className={styles.metaValue}>
                      {new Date(photo.manufacturingDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </li>
                )}
                {!photo.aircraft && photo.airline && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Airline</span>
                    <span className={styles.metaValue}>{photo.airline}</span>
                    {user && (
                      <TopicFollowButton
                        targetType="airline"
                        value={photo.airline}
                        initialIsFollowing={false}
                      />
                    )}
                  </li>
                )}
                {!photo.aircraft && photo.takenAt && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Taken</span>
                    <span className={styles.metaValue}>
                      {new Date(photo.takenAt).toLocaleDateString()}
                    </span>
                  </li>
                )}
                {!photo.aircraft && photo.photoCategory && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Category</span>
                    <span className={styles.metaValue}>{photo.photoCategory.label}</span>
                  </li>
                )}
                {!photo.aircraft && photo.aircraftSpecificCategory && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Aircraft Type</span>
                    <span className={styles.metaValue}>{photo.aircraftSpecificCategory.label}</span>
                  </li>
                )}
                <li className={styles.metaItem}>
                  <span className={styles.metaLabel}>Uploaded</span>
                  <span className={styles.metaValue}>{uploadDate}</span>
                </li>
                {photo.fileSizeBytes && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>File size</span>
                    <span className={styles.metaValue}>
                      {(photo.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Aircraft Info */}
            {photo.aircraft && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>✈️ Aircraft</h3>
                <ul className={styles.metaList}>
                  {photo.aircraft.registration && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Registration</span>
                      <span className={styles.metaValue}>{photo.aircraft.registration}</span>
                      {user && (
                        <TopicFollowButton
                          targetType="registration"
                          value={photo.aircraft.registration}
                          initialIsFollowing={photo.aircraft.isFollowedByMe ?? false}
                        />
                      )}
                    </li>
                  )}
                  {photo.aircraft.manufacturer && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Manufacturer</span>
                      <span className={styles.metaValue}>{photo.aircraft.manufacturer.name}</span>
                      {user && (
                        <TopicFollowButton
                          targetType="manufacturer"
                          value={photo.aircraft.manufacturer.name}
                          initialIsFollowing={photo.aircraft.manufacturer.isFollowedByMe ?? false}
                        />
                      )}
                    </li>
                  )}
                  {photo.aircraft.family && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Family</span>
                      <span className={styles.metaValue}>{photo.aircraft.family.name}</span>
                      {user && (
                        <TopicFollowButton
                          targetType="family"
                          value={photo.aircraft.family.name}
                          initialIsFollowing={photo.aircraft.family.isFollowedByMe ?? false}
                        />
                      )}
                    </li>
                  )}
                  {photo.aircraft.variant && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Variant</span>
                      <span className={styles.metaValue}>
                        {photo.aircraft.variant.name}
                        {photo.aircraft.variant.iataCode || photo.aircraft.variant.icaoCode
                          ? ` (${[photo.aircraft.variant.iataCode, photo.aircraft.variant.icaoCode].filter(Boolean).join('/')})`
                          : null}
                      </span>
                      {user && (
                        <TopicFollowButton
                          targetType="variant"
                          value={photo.aircraft.variant.name}
                          initialIsFollowing={photo.aircraft.variant.isFollowedByMe ?? false}
                        />
                      )}
                    </li>
                  )}
                  {(photo.aircraft.msn ?? photo.msn) && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>MSN</span>
                      <span className={styles.metaValue}>{photo.aircraft.msn ?? photo.msn}</span>
                    </li>
                  )}
                  {(photo.aircraft.manufacturingDate ?? photo.manufacturingDate) && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Built</span>
                      <span className={styles.metaValue}>
                        {new Date(
                          photo.aircraft.manufacturingDate ?? photo.manufacturingDate,
                        ).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                        })}
                      </span>
                    </li>
                  )}
                  {(photo.aircraft.operatorType ?? photo.operatorType) && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Operator Type</span>
                      <span className={styles.metaValue}>
                        {(photo.aircraft.operatorType ?? photo.operatorType ?? '')
                          .toLowerCase()
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </li>
                  )}
                  {photo.aircraft.airlineRef && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Airline</span>
                      <span className={styles.metaValue}>
                        {photo.aircraft.airlineRef.name}
                        {photo.aircraft.airlineRef.iataCode || photo.aircraft.airlineRef.icaoCode
                          ? ` (${[photo.aircraft.airlineRef.iataCode, photo.aircraft.airlineRef.icaoCode].filter(Boolean).join('/')})`
                          : null}
                      </span>
                      {user && photo.aircraft.airlineRef.icaoCode && (
                        <TopicFollowButton
                          targetType="airline"
                          value={photo.aircraft.airlineRef.icaoCode}
                          initialIsFollowing={photo.aircraft.airlineRef.isFollowedByMe ?? false}
                        />
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Gear */}
            {(photo.gearBody || photo.gearLens) && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📷 Gear Used</h3>
                <ul className={styles.metaList}>
                  {photo.gearBody && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Body</span>
                      <span className={styles.metaValue}>{photo.gearBody}</span>
                    </li>
                  )}
                  {photo.gearLens && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Lens</span>
                      <span className={styles.metaValue}>{photo.gearLens}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Photographer credit */}
            {photo.photographer && photo.photographer.id !== photo.user.id && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📸 Photographer</h3>
                <Link href={`/u/${photo.photographer.username}/photos`} className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {photo.photographer.profile?.avatarUrl ? (
                      <img
                        src={photo.photographer.profile.avatarUrl}
                        alt={photo.photographerName ?? photo.photographer.username}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <div className={styles.userDetails}>
                    <div className={styles.displayName}>
                      {photo.photographerName ?? photo.photographer.username}
                    </div>
                    <div className={styles.username}>@{photo.photographer.username}</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Location — render whenever any location data is available:
                a PhotoLocation row (with coordinates and/or linked airport),
                or a free-form `airportCode` string on the Photo itself. */}
            {(photo.location || photo.airportCode) && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📍 Location</h3>
                {photo.location && process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
                  <img
                    src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+f59e0b(${photo.location.longitude},${photo.location.latitude})/${photo.location.longitude},${photo.location.latitude},12,0/300x200@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                    alt="Photo location"
                    style={{
                      width: '100%',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 8,
                    }}
                  />
                )}
                <ul className={styles.metaList}>
                  {photo.location?.airport ? (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Airport</span>
                      <span className={styles.metaValue}>
                        <Link href={`/airports/${photo.location.airport.icaoCode}`}>
                          {photo.location.airport.name}
                        </Link>
                        {photo.location.airport.iataCode && ` (${photo.location.airport.iataCode})`}
                        {photo.location.airport.icaoCode && ` / ${photo.location.airport.icaoCode}`}
                      </span>
                      {user && photo.location.airport.icaoCode && (
                        <TopicFollowButton
                          targetType="airport"
                          value={photo.location.airport.icaoCode}
                          initialIsFollowing={false}
                        />
                      )}
                    </li>
                  ) : photo.airportCode ? (
                    /* No PhotoLocation row, but the photo has a raw airport
                       code — show it so the place isn't hidden entirely. */
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Airport</span>
                      <span className={styles.metaValue}>
                        <Link href={`/airports/${photo.airportCode}`}>{photo.airportCode}</Link>
                      </span>
                      {user && (
                        <TopicFollowButton
                          targetType="airport"
                          value={photo.airportCode}
                          initialIsFollowing={false}
                        />
                      )}
                    </li>
                  ) : null}
                  {photo.location?.spottingLocation && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Spot</span>
                      <span className={styles.metaValue}>
                        {photo.location.spottingLocation.name}
                      </span>
                    </li>
                  )}
                  {photo.location?.country && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Country</span>
                      <span className={styles.metaValue}>{photo.location.country}</span>
                    </li>
                  )}
                  {photo.location?.locationType && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Location Type</span>
                      <span className={styles.metaValue}>{photo.location.locationType}</span>
                    </li>
                  )}
                  {photo.location?.privacyMode === 'approximate' && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Accuracy</span>
                      <span className={styles.metaValue}>~1 km</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* EXIF Data */}
            {exif && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📷 EXIF Data</h3>
                <ul className={styles.metaList}>
                  {!!exif.make && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Camera</span>
                      <span className={styles.metaValue}>
                        {String(exif.make)} {String(exif.model ?? '')}
                      </span>
                    </li>
                  )}
                  {!!exif.focalLength && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Focal Length</span>
                      <span className={styles.metaValue}>
                        {String(exif.focalLength)}
                        {!!exif.focalLength35mm && ` (${String(exif.focalLength35mm)}mm equiv.)`}
                      </span>
                    </li>
                  )}
                  {!!exif.aperture && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Aperture</span>
                      <span className={styles.metaValue}>f/{String(exif.aperture)}</span>
                    </li>
                  )}
                  {!!exif.shutterSpeed && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Shutter</span>
                      <span className={styles.metaValue}>{String(exif.shutterSpeed)}s</span>
                    </li>
                  )}
                  {!!exif.iso && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>ISO</span>
                      <span className={styles.metaValue}>{String(exif.iso)}</span>
                    </li>
                  )}
                  {!!exif.takenAt && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Date Taken</span>
                      <span className={styles.metaValue}>
                        {new Date(String(exif.takenAt)).toLocaleString()}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Tags */}
            {photo.tags.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Tags</h3>
                <div className={styles.tags}>
                  {photo.tags.map((tag: string) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className={styles.card}>
              <CommentSection photoId={photo.id} />
            </div>

            {/* Ad after comments */}
            {adData?.adSettings?.slotPhotoDetail && (
              <AdBanner slotId={adData.adSettings.slotPhotoDetail} />
            )}
          </div>
        </div>

        {/* Reject modal */}
        {showRejectModal && (
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
            onClick={() => setShowRejectModal(false)}
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
              <form onSubmit={handleReject}>
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
                    rows={4}
                    placeholder="e.g. Image is heavily blurred / duplicate of an existing photo / contains personal information"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRejectModal(false)}
                    disabled={rejecting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    style={{ background: '#dc2626', color: '#fff' }}
                    disabled={rejecting}
                  >
                    {rejecting ? 'Rejecting…' : 'Reject Photo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
