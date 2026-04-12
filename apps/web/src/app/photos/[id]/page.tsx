'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { CommentSection } from '@/components/CommentSection';
import { FollowButton } from '@/components/FollowButton';
import { LikeButton } from '@/components/LikeButton';
import { ReportButton } from '@/components/ReportButton';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import { GET_PHOTO } from '@/lib/queries';

import styles from './page.module.css';

interface PhotoVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

export default function PhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [result] = useQuery({ query: GET_PHOTO, variables: { id } });
  const { data, fetching, error } = result;
  const [imgError, setImgError] = useState(false);

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
  const displayVariant = photo.variants.find(
    (v: PhotoVariant) => v.variantType === 'display',
  );
  const imageUrl = displayVariant?.url ?? photo.originalUrl;
  const displayName =
    photo.user.profile?.displayName ?? photo.user.username;
  const uploadDate = new Date(photo.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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

          {/* Sidebar */}
          <div className={styles.sidebar}>
            {/* User */}
            <div className={styles.card}>
              <div className={styles.userRow}>
                <Link
                  href={`/u/${photo.user.username}/photos`}
                  className={styles.userInfo}
                >
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
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Details</h3>
              <ul className={styles.metaList}>
                {photo.aircraftType && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Aircraft</span>
                    <span className={styles.metaValue}>
                      {photo.aircraftType}
                      {user && (
                        <span className={styles.metaFollow}>
                          <TopicFollowButton
                            targetType="aircraft_type"
                            value={photo.aircraftType}
                            initialIsFollowing={false}
                          />
                        </span>
                      )}
                    </span>
                  </li>
                )}
                {photo.airline && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Airline</span>
                    <span className={styles.metaValue}>{photo.airline}</span>
                  </li>
                )}
                {photo.airportCode && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Airport</span>
                    <span className={styles.metaValue}>
                      {photo.airportCode}
                    </span>
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
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Registration</span>
                    <span className={styles.metaValue}>{photo.aircraft.registration}</span>
                  </li>
                  {photo.aircraft.msn && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>MSN</span>
                      <span className={styles.metaValue}>{photo.aircraft.msn}</span>
                    </li>
                  )}
                  {photo.aircraft.manufacturingDate && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Built</span>
                      <span className={styles.metaValue}>
                        {new Date(photo.aircraft.manufacturingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      </span>
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
                <Link
                  href={`/u/${photo.photographer.username}/photos`}
                  className={styles.userInfo}
                >
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
                          {photo.location.airport.name} ({photo.location.airport.iataCode ?? photo.location.airport.icaoCode})
                        </Link>
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
                  {photo.location.privacyMode === 'approximate' && (
                    <li className={styles.metaItem}>
                      <span className={styles.metaLabel}>Accuracy</span>
                      <span className={styles.metaValue}>~1 km</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
