'use client';

import Link from 'next/link';
import { type FormEvent, use, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { AirportFollowButton } from '@/components/AirportFollowButton';
import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import {
  CREATE_SPOTTING_LOCATION,
  DELETE_SPOTTING_LOCATION,
  GET_AIRPORT,
  GET_PHOTOS,
} from '@/lib/queries';

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
  const { user } = useAuth();
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);

  // Spotting location form state
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotName, setSpotName] = useState('');
  const [spotDesc, setSpotDesc] = useState('');
  const [spotAccess, setSpotAccess] = useState('');
  const [spotLat, setSpotLat] = useState('');
  const [spotLng, setSpotLng] = useState('');
  const [spotError, setSpotError] = useState<string | null>(null);

  const [, createSpottingLocation] = useMutation(CREATE_SPOTTING_LOCATION);
  const [, deleteSpottingLocation] = useMutation(DELETE_SPOTTING_LOCATION);

  const [airportResult, reexecuteAirport] = useQuery({
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

  // ─── Spotting Location handlers ──────────────────────────────────────────

  const handleCreateSpot = async (e: FormEvent) => {
    e.preventDefault();
    setSpotError(null);
    if (!airport) return;

    const result = await createSpottingLocation({
      input: {
        name: spotName,
        description: spotDesc || undefined,
        accessNotes: spotAccess || undefined,
        latitude: spotLat ? parseFloat(spotLat) : 0,
        longitude: spotLng ? parseFloat(spotLng) : 0,
        airportId: airport.id,
      },
    });

    if (result.error) {
      setSpotError(result.error.graphQLErrors[0]?.message ?? 'Failed to create spotting location');
      return;
    }

    // Reset form and refresh
    setSpotName('');
    setSpotDesc('');
    setSpotAccess('');
    setSpotLat('');
    setSpotLng('');
    setShowSpotForm(false);
    reexecuteAirport({ requestPolicy: 'network-only' });
  };

  const handleDeleteSpot = async (spotId: string) => {
    const result = await deleteSpottingLocation({ id: spotId });
    if (!result.error) {
      reexecuteAirport({ requestPolicy: 'network-only' });
    }
  };

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
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Spotting Locations</h2>
          {airport.spottingLocations.length > 0 ? (
            <div className={styles.spotList}>
              {airport.spottingLocations.map((spot: SpottingLocation) => (
                <div key={spot.id} className={styles.spotCard}>
                  <div className={styles.spotCardHeader}>
                    <div className={styles.spotName}>📍 {spot.name}</div>
                    {user && (
                      <button
                        className={styles.spotDelete}
                        onClick={() => handleDeleteSpot(spot.id)}
                        title="Delete spotting location"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
          ) : (
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
              No spotting locations yet. Be the first to add one!
            </p>
          )}

          {user && !showSpotForm && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowSpotForm(true)}
            >
              + Add Spotting Location
            </button>
          )}

          {showSpotForm && (
            <form onSubmit={handleCreateSpot} className={styles.spotForm}>
              <div className="field">
                <label htmlFor="spotName" className="label">Name *</label>
                <input
                  id="spotName"
                  type="text"
                  className="input"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                  placeholder="e.g. South Viewpoint"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="spotDesc" className="label">Description</label>
                <textarea
                  id="spotDesc"
                  className="input"
                  value={spotDesc}
                  onChange={(e) => setSpotDesc(e.target.value)}
                  placeholder="What can you see from here?"
                  rows={2}
                />
              </div>
              <div className="field">
                <label htmlFor="spotAccess" className="label">Access Notes</label>
                <input
                  id="spotAccess"
                  type="text"
                  className="input"
                  value={spotAccess}
                  onChange={(e) => setSpotAccess(e.target.value)}
                  placeholder="e.g. Free parking, walk 5 min"
                />
              </div>
              <div className={styles.spotCoords}>
                <div className="field">
                  <label htmlFor="spotLat" className="label">Latitude</label>
                  <input
                    id="spotLat"
                    type="number"
                    className="input"
                    value={spotLat}
                    onChange={(e) => setSpotLat(e.target.value)}
                    placeholder="Latitude"
                    step="any"
                  />
                </div>
                <div className="field">
                  <label htmlFor="spotLng" className="label">Longitude</label>
                  <input
                    id="spotLng"
                    type="number"
                    className="input"
                    value={spotLng}
                    onChange={(e) => setSpotLng(e.target.value)}
                    placeholder="Longitude"
                    step="any"
                  />
                </div>
              </div>
              {spotError && <p className="error-text">{spotError}</p>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary">
                  Save Location
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSpotForm(false);
                    setSpotError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

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
