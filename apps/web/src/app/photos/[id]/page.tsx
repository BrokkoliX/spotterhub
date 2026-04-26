'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { CommentSection } from '@/components/CommentSection';
import { FollowButton } from '@/components/FollowButton';
import { LikeButton } from '@/components/LikeButton';
import { ReportButton } from '@/components/ReportButton';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import { GET_PHOTO, DELETE_PHOTO, CREATE_PHOTO_PURCHASE } from '@/lib/queries';

import styles from './page.module.css';

interface PhotoVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

export default function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [result] = useQuery({ query: GET_PHOTO, variables: { id } });
  const { data, fetching, error } = result;
  const [{ fetching: deleting }, deletePhoto] = useMutation(DELETE_PHOTO);
  const [imgError, setImgError] = useState(false);

  const isOwner = user?.id === data?.photo?.user?.id;
  const isPrivileged =
    user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'superuser';
  const canDelete = isOwner || isPrivileged;

  const handleDelete = async () => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    const res = await deletePhoto({ photoId: id });
    if (res.data?.deletePhoto) {
      router.push('/');
    }
  };

  // Marketplace purchase
  const [{ fetching: purchasing }, createPurchase] = useMutation(CREATE_PHOTO_PURCHASE);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

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
  const displayVariant = photo.variants.find((v: PhotoVariant) => v.variantType === 'display');
  const imageUrl = displayVariant?.url ?? photo.originalUrl;
  const displayName = photo.user.profile?.displayName ?? photo.user.username;
  const uploadDate = new Date(photo.createdAt).toLocaleDateString('en-US', {
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
        <Link href="/" className={styles.backLink}>
          ← Back to feed
        </Link>

        <div className={styles.layout}>
          {/* Image */}
          <div className={styles.imageContainer}>
            {imageUrl && !imgError ? (
              <img
                src={imageUrl}
                alt={photo.caption ?? `Photo by ${displayName}`}
                className={styles.image}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className={styles.imagePlaceholder}>📷</div>
            )}
          </div>

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
                <div className={styles.stats}>
                  <LikeButton
                    photoId={photo.id}
                    initialLikeCount={photo.likeCount}
                    initialIsLiked={photo.isLikedByMe}
                  />
                  <span className={styles.stat}>💬 {photo.commentCount}</span>
                  <ReportButton targetType="photo" targetId={photo.id} />
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
            )}

            {/* Metadata */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Details</h3>
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
                      {new Date(photo.manufacturingDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </li>
                )}
                {photo.airline && (
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
                {photo.airportCode && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Airport</span>
                    <span className={styles.metaValue}>{photo.airportCode}</span>
                    {user && (
                      <TopicFollowButton
                        targetType="airport"
                        value={photo.airportCode}
                        initialIsFollowing={false}
                      />
                    )}
                  </li>
                )}
                {photo.operatorIcao && (
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
                {photo.operatorType && (
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
                {photo.msn && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>MSN</span>
                    <span className={styles.metaValue}>{photo.msn}</span>
                  </li>
                )}
                {photo.manufacturingDate && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Built</span>
                    <span className={styles.metaValue}>
                      {new Date(photo.manufacturingDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </li>
                )}
                {photo.airline && (
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
                {photo.airportCode && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Airport</span>
                    <span className={styles.metaValue}>{photo.airportCode}</span>
                    {user && (
                      <TopicFollowButton
                        targetType="airport"
                        value={photo.airportCode}
                        initialIsFollowing={false}
                      />
                    )}
                  </li>
                )}
                {photo.takenAt && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Taken</span>
                    <span className={styles.metaValue}>
                      {new Date(photo.takenAt).toLocaleDateString()}
                    </span>
                  </li>
                )}
                {photo.photoCategory && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Category</span>
                    <span className={styles.metaValue}>{photo.photoCategory.label}</span>
                  </li>
                )}
                {photo.aircraftSpecificCategory && (
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

            {/* Location */}
            {photo.location && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📍 Location</h3>
                {process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
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
                  {photo.location.airport && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Airport</span>
                      <span className={styles.metaValue}>
                        <Link href={`/airports/${photo.location.airport.icaoCode}`}>
                          {photo.location.airport.name}
                        </Link>
                        {photo.location.airport.iataCode && ` (${photo.location.airport.iataCode})`}
                        {photo.location.airport.icaoCode && ` / ${photo.location.airport.icaoCode}`}
                      </span>
                    </li>
                  )}
                  {photo.location.spottingLocation && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Spot</span>
                      <span className={styles.metaValue}>
                        {photo.location.spottingLocation.name}
                      </span>
                    </li>
                  )}
                  {photo.location.country && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Country</span>
                      <span className={styles.metaValue}>{photo.location.country}</span>
                    </li>
                  )}
                  {photo.location.locationType && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Location Type</span>
                      <span className={styles.metaValue}>{photo.location.locationType}</span>
                    </li>
                  )}
                  {photo.location.privacyMode === 'approximate' && (
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

            {/* More aircraft photos */}
            {photo.similarAircraftPhotos && photo.similarAircraftPhotos.edges.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>✈️ More from this aircraft</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 8,
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
                          <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                            <img
                              src={
                                similar.variants?.find((v) => v.variantType === 'thumbnail')?.url ??
                                similar.variants?.[0]?.url ??
                                ''
                              }
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ padding: '6px 8px', fontSize: '0.75rem' }}>
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

            {/* Comments */}
            <div className={styles.card}>
              <CommentSection photoId={photo.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
