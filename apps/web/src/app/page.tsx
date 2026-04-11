'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import { GET_FOLLOWING_FEED, GET_PHOTOS, GET_SITE_SETTINGS } from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 24;

type FeedTab = 'recent' | 'following';
type SortOption = 'recent' | 'popular_day' | 'popular_week' | 'popular_month' | 'popular_all';

const SORT_OPTIONS: { value: SortOption; label: string; emoji: string }[] = [
  { value: 'recent', label: 'Recent', emoji: '🕐' },
  { value: 'popular_day', label: 'Today', emoji: '⭐' },
  { value: 'popular_week', label: 'This Week', emoji: '🔥' },
  { value: 'popular_month', label: 'This Month', emoji: '🚀' },
  { value: 'popular_all', label: 'All Time', emoji: '🏆' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [feedTab, setFeedTab] = useState<FeedTab>('recent');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [aircraftFilter, setAircraftFilter] = useState('');
  const [airportFilter, setAirportFilter] = useState('');
  const [debouncedAircraft, setDebouncedAircraft] = useState('');
  const [debouncedAirport, setDebouncedAirport] = useState('');

  const [{ data: siteData }] = useQuery({ query: GET_SITE_SETTINGS });
  const siteBannerUrl = siteData?.siteSettings?.bannerUrl;
  const siteTagline = siteData?.siteSettings?.tagline;

  // Key to force-remount PhotoGrid on filter change

  const aircraftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const airportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(aircraftTimer.current);
    aircraftTimer.current = setTimeout(() => {
      setDebouncedAircraft(aircraftFilter);
    }, 300);
    return () => clearTimeout(aircraftTimer.current);
  }, [aircraftFilter]);

  useEffect(() => {
    clearTimeout(airportTimer.current);
    airportTimer.current = setTimeout(() => {
      setDebouncedAirport(airportFilter);
    }, 300);
    return () => clearTimeout(airportTimer.current);
  }, [airportFilter]);

  // Force PhotoGrid remount when filters change
  const gridKey = useMemo(
    () => `${debouncedAircraft}-${debouncedAirport}-${sortBy}`,
    [debouncedAircraft, debouncedAirport, sortBy],
  );

  const [{ data, fetching }] = useQuery({
    query: GET_PHOTOS,
    variables: {
      first: PAGE_SIZE,
      aircraftType: debouncedAircraft || undefined,
      airportCode: debouncedAirport || undefined,
      sortBy: sortBy !== 'recent' ? sortBy : undefined,
    },
    pause: feedTab !== 'recent',
  });

  const [{ data: followingData, fetching: followingFetching }] = useQuery({
    query: GET_FOLLOWING_FEED,
    variables: { first: PAGE_SIZE },
    pause: feedTab !== 'following' || !user,
  });

  const handleTabChange = (tab: FeedTab) => {
    setFeedTab(tab);
  };

  const connection = feedTab === 'recent' ? data?.photos : followingData?.followingFeed;
  const displayedPhotos: PhotoData[] =
    connection?.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
  const isLoading = feedTab === 'recent' ? fetching : followingFetching;

  return (
    <div>
      {/* Hero Banner */}
      <div className={styles.hero} style={siteBannerUrl ? {
        backgroundImage: `url(${siteBannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}>
        {siteBannerUrl && <div className={styles.heroBannerOverlay} />}
        {!siteBannerUrl && <div className={styles.heroGradient} />}
        <div className={styles.heroContent}>
          {!siteBannerUrl && <div className={styles.heroEmoji}>🛩️</div>}
          <h1 className={styles.heroTitle}>SpotterHub</h1>
          <p className={styles.heroSubtitle}>
            {siteTagline || "The world's community for aviation photography"}
          </p>
          <div className={styles.heroStats}>
            <span>📷 Thousands of photos</span>
            <span>✈️ Aircraft from around the world</span>
            <span>👥 Join a global community</span>
          </div>
          {!user && (
            <div className={styles.heroCta}>
              <Link href="/signin" className="btn btn-primary">
                Sign in to upload
              </Link>
              <Link href="/communities" className="btn btn-secondary">
                Explore Communities
              </Link>
            </div>
          )}
          {user && (
            <div className={styles.heroCta}>
              <Link href="/upload" className="btn btn-primary">
                📷 Upload to My Collection
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="container">
        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterRow}>
            <div className={styles.filterInputWrap}>
              <span className={styles.filterIcon}>🔍</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Aircraft type (e.g. Boeing 747)"
                value={aircraftFilter}
                onChange={(e) => setAircraftFilter(e.target.value)}
              />
            </div>
            <div className={styles.filterInputWrap}>
              <span className={styles.filterIcon}>🛫</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Airport (e.g. KLAX)"
                value={airportFilter}
                onChange={(e) => setAirportFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Sort Pills */}
          <div className={styles.sortPills}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.sortPill} ${sortBy === opt.value ? styles.sortPillActive : ''}`}
                onClick={() => setSortBy(opt.value)}
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Feed Toggle */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${feedTab === 'recent' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('recent')}
          >
            Recent
          </button>
          <button
            type="button"
            className={`${styles.tab} ${feedTab === 'following' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('following')}
          >
            Following
          </button>
        </div>

        {/* Sign-in prompt */}
        {feedTab === 'following' && !user && (
          <div className={styles.signInPrompt}>
            <p>
              <Link href="/signin">Sign in</Link> to see photos from people,
              airports, and topics you follow.
            </p>
          </div>
        )}

        {/* Photo Grid */}
        {(feedTab === 'recent' || user) && (
          <PhotoGrid
            key={gridKey}
            photos={displayedPhotos}
            hasNextPage={connection?.pageInfo?.hasNextPage ?? false}
            loading={isLoading}
            onLoadMore={() => {}}
            emptyMessage={
              feedTab === 'following'
                ? 'No photos yet. Follow users, airports, or topics to build your feed!'
                : fetching
                ? undefined
                : 'No photos match your filters.'
            }
          />
        )}
      </div>
    </div>
  );
}
