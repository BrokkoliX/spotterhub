'use client';

import Link from 'next/link';
import { use, useCallback, useState } from 'react';
import { useQuery } from 'urql';

import { AirportFollowButton } from '@/components/AirportFollowButton';
import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { GET_AIRPORT, GET_PHOTOS } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SpottingLocation {
  id: string;
  name: string;
  description?: string | null;
  accessNotes?: string | null;
  latitude: number;
  longitude: number;
}

const PAGE_SIZE = 12;

// ─── Component ──────────────────────────────────────────────────────────────

export default function AirportPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);

  const [airportResult] = useQuery({
    query: GET_AIRPORT,
    variables: { code: code.toUpperCase() },
  });

  const [photosResult] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: cursor, airportCode: code.toUpperCase() },
  });

  const airport = airportResult.data?.airport;
  const connection = photosResult.data?.photos;

  const photos: PhotoData[] =
    allPhotos.length > 0
      ? allPhotos
      : connection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];

  const handleLoadMore = useCallback(() => {
    if (connection?.pageInfo?.endCursor) {
      setAllPhotos((prev) => {
        const existing = prev.length > 0 ? prev : photos;
        const newPhotos = connection.edges
          .map((e: { node: PhotoData }) => e.node)
          .filter((p: PhotoData) => !existing.some((ep: PhotoData) => ep.id === p.id));
        return [...existing, ...newPhotos];
      });
      setCursor(connection.pageInfo.endCursor);
    }
  }, [connection, photos]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (airportResult.fetching) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading airport…</p>
        </div>
      </div>
    );
  }

  if (!airport) {
    return (
      <div className={styles.page}>
        <div className="container">
          <Link href="/map" className={styles.backLink}>
            ← Back to map
          </Link>
          <div className={styles.notFound}>
            <h2>Airport not found</h2>
            <p>No airport with code &ldquo;{code.toUpperCase()}&rdquo; exists.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayCode = airport.iataCode
    ? `${airport.icaoCode} / ${airport.iataCode}`
    : airport.icaoCode;

  return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/map" className={styles.backLink}>
          ← Back to map
        </Link>

        {/* Airport Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.airportIcon}>✈️</div>
            <div className={styles.airportInfo}>
              <h1 className={styles.airportName}>{airport.name}</h1>
              <div className={styles.airportCodes}>{displayCode}</div>
              {(airport.city || airport.country) && (
                <div className={styles.airportLocation}>
                  📍 {[airport.city, airport.country].filter(Boolean).join(', ')}
                </div>
              )}
              <div className={styles.coords}>
                {airport.latitude.toFixed(4)}°, {airport.longitude.toFixed(4)}°
              </div>
            </div>
            <AirportFollowButton
              airportId={airport.id}
              initialIsFollowing={airport.isFollowedByMe}
            />
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{airport.photoCount}</span>
              <span className={styles.statLabel}>Photos</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{airport.followerCount}</span>
              <span className={styles.statLabel}>Followers</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{airport.spottingLocations.length}</span>
              <span className={styles.statLabel}>Spotting Locations</span>
            </div>
          </div>
        </div>

        {/* Spotting Locations */}
        {airport.spottingLocations.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Spotting Locations</h2>
            <div className={styles.spotList}>
              {airport.spottingLocations.map((spot: SpottingLocation) => (
                <div key={spot.id} className={styles.spotCard}>
                  <div className={styles.spotName}>📍 {spot.name}</div>
                  {spot.description && (
                    <div className={styles.spotDesc}>{spot.description}</div>
                  )}
                  {spot.accessNotes && (
                    <div className={styles.spotAccess}>
                      Access: {spot.accessNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos at this airport */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Photos at {displayCode}</h2>
          <PhotoGrid
            photos={photos}
            hasNextPage={connection?.pageInfo?.hasNextPage ?? false}
            loading={photosResult.fetching}
            onLoadMore={handleLoadMore}
            emptyMessage={`No photos at ${displayCode} yet`}
          />
        </div>
      </div>
    </div>
  );
}
