'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import { GET_FOLLOWING_FEED, GET_PHOTOS, GET_SITE_SETTINGS, SEARCH_AIRCRAFT_TYPES, SEARCH_AIRLINES, SEARCH_AIRPORTS, SEARCH_USERS } from '@/lib/queries';

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
  const [airlineFilter, setAirlineFilter] = useState('');
  const [photographerFilter, setPhotographerFilter] = useState('');
  const [debouncedAircraft, setDebouncedAircraft] = useState('');
  const [debouncedAirport, setDebouncedAirport] = useState('');
  const [debouncedAirline, setDebouncedAirline] = useState('');
  const [debouncedPhotographer, setDebouncedPhotographer] = useState('');

  const [{ data: siteData }] = useQuery({ query: GET_SITE_SETTINGS });
  const siteBannerUrl = siteData?.siteSettings?.bannerUrl;
  const siteTagline = siteData?.siteSettings?.tagline;

  // Key to force-remount PhotoGrid on filter change

  const aircraftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const airportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const airlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const photographerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  useEffect(() => {
    clearTimeout(airlineTimer.current);
    airlineTimer.current = setTimeout(() => {
      setDebouncedAirline(airlineFilter);
    }, 300);
    return () => clearTimeout(airlineTimer.current);
  }, [airlineFilter]);

  useEffect(() => {
    clearTimeout(photographerTimer.current);
    photographerTimer.current = setTimeout(() => {
      setDebouncedPhotographer(photographerFilter);
    }, 300);
    return () => clearTimeout(photographerTimer.current);
  }, [photographerFilter]);

  // Force PhotoGrid remount when filters change
  const gridKey = useMemo(
    () => `${debouncedAircraft}-${debouncedAirport}-${debouncedAirline}-${debouncedPhotographer}-${sortBy}`,
    [debouncedAircraft, debouncedAirport, debouncedAirline, debouncedPhotographer, sortBy],
  );

  const [{ data, fetching }] = useQuery({
    query: GET_PHOTOS,
    variables: {
      first: PAGE_SIZE,
      aircraftType: debouncedAircraft || undefined,
      airportCode: debouncedAirport || undefined,
      airline: debouncedAirline || undefined,
      photographer: debouncedPhotographer || undefined,
      sortBy: sortBy !== 'recent' ? sortBy : undefined,
    },
    pause: feedTab !== 'recent',
  });

  // Airline typeahead
  const [showAirlineDropdown, setShowAirlineDropdown] = useState(false);
  const [{ data: airlineData, fetching: airlineFetching }] = useQuery({
    query: SEARCH_AIRLINES,
    variables: { query: airlineFilter, first: 8 },
    pause: airlineFilter.length < 2,
  });

  // Aircraft type typeahead
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false);
  const [{ data: aircraftData, fetching: aircraftFetching }] = useQuery({
    query: SEARCH_AIRCRAFT_TYPES,
    variables: { search: aircraftFilter, first: 8 },
    pause: aircraftFilter.length < 2,
  });
  const aircraftResults: Array<{ id: string; manufacturer: string; aircraftName: string; icaoCode: string | null }> =
    aircraftData?.aircraftTypes?.edges?.map((e: { node: { id: string; manufacturer: string; aircraftName: string; icaoCode: string | null } }) => e.node) ?? [];

  // Airport typeahead
  const [showAirportDropdown, setShowAirportDropdown] = useState(false);
  const [{ data: airportData, fetching: airportFetching }] = useQuery({
    query: SEARCH_AIRPORTS,
    variables: { query: airportFilter, first: 8 },
    pause: airportFilter.length < 2,
  });
  const airportResults: Array<{ icaoCode: string; iataCode: string | null; name: string; city: string | null }> =
    airportData?.searchAirports ?? [];
  const airlineResults: string[] = airlineData?.searchAirlines ?? [];

  // Photographer typeahead
  const [showPhotographerDropdown, setShowPhotographerDropdown] = useState(false);
  const [{ data: photographerData, fetching: photographerFetching }] = useQuery({
    query: SEARCH_USERS,
    variables: { query: photographerFilter, first: 8 },
    pause: photographerFilter.length < 2,
  });
  const photographerResults: Array<{ id: string; username: string; profile?: { displayName?: string | null } }> =
    photographerData?.searchUsers?.edges?.map((e: { node: { id: string; username: string; profile?: { displayName?: string | null } } }) => e.node) ?? [];

  // Click outside to close all dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(`.${styles.filterInputWrap}`)) {
        setShowAirlineDropdown(false);
        setShowAircraftDropdown(false);
        setShowAirportDropdown(false);
        setShowPhotographerDropdown(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
          <h1 className={styles.heroTitle}>SpotterSpace</h1>
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
            {/* Aircraft Type — typeahead */}
            <div className={styles.filterInputWrap} style={{ position: 'relative', flex: 1 }}>
              <span className={styles.filterIcon}>🔍</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Aircraft type (e.g. Boeing 747)"
                value={aircraftFilter}
                onChange={(e) => {
                  setAircraftFilter(e.target.value);
                  setShowAircraftDropdown(e.target.value.length >= 2);
                }}
                onFocus={() => aircraftFilter.length >= 2 && setShowAircraftDropdown(true)}
              />
              {showAircraftDropdown && (aircraftResults.length > 0 || aircraftFetching) && (
                <div className={styles.filterDropdown}>
                  {aircraftFetching && aircraftFilter.length >= 2 ? (
                    <div className={styles.filterDropdownItem}>Searching…</div>
                  ) : (
                    aircraftResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={styles.filterDropdownItem}
                        onClick={() => {
                          setAircraftFilter(`${a.manufacturer} ${a.aircraftName}`);
                          setDebouncedAircraft(`${a.manufacturer} ${a.aircraftName}`);
                          setShowAircraftDropdown(false);
                        }}
                      >
                        {a.manufacturer} {a.aircraftName} {a.icaoCode ? `(${a.icaoCode})` : ''}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showAircraftDropdown && aircraftFilter.length >= 2 && !aircraftFetching && aircraftResults.length === 0 && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterDropdownItem}>No aircraft found</div>
                </div>
              )}
            </div>
            {/* Airport — typeahead */}
            <div className={styles.filterInputWrap} style={{ position: 'relative', flex: 1 }}>
              <span className={styles.filterIcon}>🛫</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Airport (e.g. KLAX)"
                value={airportFilter}
                onChange={(e) => {
                  setAirportFilter(e.target.value);
                  setShowAirportDropdown(e.target.value.length >= 2);
                }}
                onFocus={() => airportFilter.length >= 2 && setShowAirportDropdown(true)}
              />
              {showAirportDropdown && (airportResults.length > 0 || airportFetching) && (
                <div className={styles.filterDropdown}>
                  {airportFetching && airportFilter.length >= 2 ? (
                    <div className={styles.filterDropdownItem}>Searching…</div>
                  ) : (
                    airportResults.map((a) => (
                      <button
                        key={a.icaoCode}
                        type="button"
                        className={styles.filterDropdownItem}
                        onClick={() => {
                          setAirportFilter(a.icaoCode);
                          setDebouncedAirport(a.icaoCode);
                          setShowAirportDropdown(false);
                        }}
                      >
                        {a.name} ({a.icaoCode}){a.city ? ` — ${a.city}` : ''}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showAirportDropdown && airportFilter.length >= 2 && !airportFetching && airportResults.length === 0 && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterDropdownItem}>No airports found</div>
                </div>
              )}
            </div>
            {/* Airline — typeahead */}
            <div className={styles.filterInputWrap} style={{ position: 'relative', flex: 1 }}>
              <span className={styles.filterIcon}>✈️</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Airline"
                value={airlineFilter}
                onChange={(e) => {
                  setAirlineFilter(e.target.value);
                  setShowAirlineDropdown(e.target.value.length >= 2);
                }}
                onFocus={() => airlineFilter.length >= 2 && setShowAirlineDropdown(true)}
              />
              {showAirlineDropdown && (airlineResults.length > 0 || airlineFetching) && (
                <div className={styles.filterDropdown}>
                  {airlineFetching && airlineFilter.length >= 2 ? (
                    <div className={styles.filterDropdownItem}>Searching…</div>
                  ) : (
                    airlineResults.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={styles.filterDropdownItem}
                        onClick={() => {
                          setAirlineFilter(name);
                          setDebouncedAirline(name);
                          setShowAirlineDropdown(false);
                        }}
                      >
                        {name}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showAirlineDropdown && airlineFilter.length >= 2 && !airlineFetching && airlineResults.length === 0 && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterDropdownItem}>No airlines found</div>
                </div>
              )}
            </div>
            {/* Photographer — typeahead */}
            <div className={styles.filterInputWrap} style={{ position: 'relative', flex: 1 }}>
              <span className={styles.filterIcon}>📷</span>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Photographer"
                value={photographerFilter}
                onChange={(e) => {
                  setPhotographerFilter(e.target.value);
                  setShowPhotographerDropdown(e.target.value.length >= 2);
                }}
                onFocus={() => photographerFilter.length >= 2 && setShowPhotographerDropdown(true)}
              />
              {showPhotographerDropdown && (photographerResults.length > 0 || photographerFetching) && (
                <div className={styles.filterDropdown}>
                  {photographerFetching && photographerFilter.length >= 2 ? (
                    <div className={styles.filterDropdownItem}>Searching…</div>
                  ) : (
                    photographerResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={styles.filterDropdownItem}
                        onClick={() => {
                          setPhotographerFilter(u.profile?.displayName || u.username);
                          setDebouncedPhotographer(u.profile?.displayName || u.username);
                          setShowPhotographerDropdown(false);
                        }}
                      >
                        {u.profile?.displayName || u.username}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showPhotographerDropdown && photographerFilter.length >= 2 && !photographerFetching && photographerResults.length === 0 && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterDropdownItem}>No photographers found</div>
                </div>
              )}
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
