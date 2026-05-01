'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { AdBanner } from '@/components/AdBanner';
import { FilterDrawer } from '@/components/FilterDrawer';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import {
  GET_AIRCRAFT_FAMILIES,
  GET_AIRCRAFT_MANUFACTURERS,
  GET_AIRCRAFT_VARIANTS,
  GET_FOLLOWING_FEED,
  GET_PHOTOS,
  GET_SITE_SETTINGS,
  GET_AD_SETTINGS,
  SEARCH_AIRLINES,
  SEARCH_AIRPORTS,
  SEARCH_USERS,
} from '@/lib/queries';

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

interface TypeaheadInputProps<T> {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  minChars?: number;
  results: T[];
  fetching: boolean;
  renderItem: (item: T) => { key: string; label: string };
  onSelect: (item: T) => void;
  emptyLabel: string;
}

function TypeaheadInput<T>({
  icon,
  placeholder,
  value,
  onChange,
  showDropdown,
  setShowDropdown,
  minChars = 2,
  results,
  fetching,
  renderItem,
  onSelect,
  emptyLabel,
}: TypeaheadInputProps<T>) {
  const meetsMin = value.length >= minChars;
  return (
    <div className={styles.filterInputWrap} style={{ position: 'relative', flex: 1 }}>
      <span className={styles.filterIcon}>{icon}</span>
      <input
        type="text"
        className={styles.filterInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(e.target.value.length >= minChars);
        }}
        onFocus={() => meetsMin && setShowDropdown(true)}
      />
      {showDropdown && (results.length > 0 || fetching) && (
        <div className={styles.filterDropdown}>
          {fetching && meetsMin ? (
            <div className={styles.filterDropdownItem}>Searching…</div>
          ) : (
            results.map((item) => {
              const { key, label } = renderItem(item);
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.filterDropdownItem}
                  onClick={() => {
                    onSelect(item);
                    setShowDropdown(false);
                  }}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      )}
      {showDropdown && meetsMin && !fetching && results.length === 0 && (
        <div className={styles.filterDropdown}>
          <div className={styles.filterDropdownItem}>{emptyLabel}</div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [feedTab, setFeedTab] = useState<FeedTab>('recent');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [airportFilter, setAirportFilter] = useState('');
  const [airlineFilter, setAirlineFilter] = useState('');
  const [photographerFilter, setPhotographerFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');
  const [debouncedAirport, setDebouncedAirport] = useState('');
  const [debouncedAirline, setDebouncedAirline] = useState('');
  const [debouncedPhotographer, setDebouncedPhotographer] = useState('');
  const [debouncedManufacturer, setDebouncedManufacturer] = useState('');
  const [debouncedFamily, setDebouncedFamily] = useState('');
  const [debouncedVariant, setDebouncedVariant] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [{ data: siteData }] = useQuery({ query: GET_SITE_SETTINGS });
  const [{ data: adData }] = useQuery({ query: GET_AD_SETTINGS });
  const siteBannerUrl = siteData?.siteSettings?.bannerUrl;
  const siteTagline = siteData?.siteSettings?.tagline;
  const feedAdSlot = adData?.adSettings?.slotFeed ?? null;

  const airportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const airlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const photographerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manufacturerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const familyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const variantTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  useEffect(() => {
    clearTimeout(manufacturerTimer.current);
    manufacturerTimer.current = setTimeout(() => {
      setDebouncedManufacturer(manufacturerFilter);
    }, 300);
    return () => clearTimeout(manufacturerTimer.current);
  }, [manufacturerFilter]);

  useEffect(() => {
    clearTimeout(familyTimer.current);
    familyTimer.current = setTimeout(() => {
      setDebouncedFamily(familyFilter);
    }, 300);
    return () => clearTimeout(familyTimer.current);
  }, [familyFilter]);

  useEffect(() => {
    clearTimeout(variantTimer.current);
    variantTimer.current = setTimeout(() => {
      setDebouncedVariant(variantFilter);
    }, 300);
    return () => clearTimeout(variantTimer.current);
  }, [variantFilter]);

  const gridKey = useMemo(
    () =>
      `${debouncedAirport}-${debouncedAirline}-${debouncedPhotographer}-${debouncedManufacturer}-${debouncedFamily}-${debouncedVariant}-${sortBy}`,
    [
      debouncedAirport,
      debouncedAirline,
      debouncedPhotographer,
      debouncedManufacturer,
      debouncedFamily,
      debouncedVariant,
      sortBy,
    ],
  );

  const [{ data, fetching }] = useQuery({
    query: GET_PHOTOS,
    variables: {
      first: PAGE_SIZE,
      airportCode: debouncedAirport || undefined,
      airline: debouncedAirline || undefined,
      photographer: debouncedPhotographer || undefined,
      manufacturer: debouncedManufacturer || undefined,
      family: debouncedFamily || undefined,
      variant: debouncedVariant || undefined,
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

  // Airport typeahead
  const [showAirportDropdown, setShowAirportDropdown] = useState(false);
  const [{ data: airportData, fetching: airportFetching }] = useQuery({
    query: SEARCH_AIRPORTS,
    variables: { query: airportFilter, first: 8 },
    pause: airportFilter.length < 2,
  });
  const airportResults: Array<{
    icaoCode: string;
    iataCode: string | null;
    name: string;
    city: string | null;
  }> = airportData?.searchAirports ?? [];
  const airlineResults: string[] = airlineData?.searchAirlines ?? [];

  // Photographer typeahead
  const [showPhotographerDropdown, setShowPhotographerDropdown] = useState(false);
  const [{ data: photographerData, fetching: photographerFetching }] = useQuery({
    query: SEARCH_USERS,
    variables: { query: photographerFilter, first: 8 },
    pause: photographerFilter.length < 2,
  });
  const photographerResults: Array<{
    id: string;
    username: string;
    profile?: { displayName?: string | null };
  }> =
    photographerData?.searchUsers?.edges?.map(
      (e: { node: { id: string; username: string; profile?: { displayName?: string | null } } }) =>
        e.node,
    ) ?? [];

  // Manufacturer typeahead
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
  const [{ data: manufacturerData, fetching: manufacturerFetching }] = useQuery({
    query: GET_AIRCRAFT_MANUFACTURERS,
    variables: { search: manufacturerFilter, first: 8 },
    pause: manufacturerFilter.length < 2,
  });
  const manufacturerResults: Array<{ id: string; name: string }> =
    manufacturerData?.aircraftManufacturers?.edges?.map(
      (e: { node: { id: string; name: string } }) => e.node,
    ) ?? [];

  // Family typeahead (cascading — filtered by selected manufacturer)
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [{ data: familyData, fetching: familyFetching }] = useQuery({
    query: GET_AIRCRAFT_FAMILIES,
    variables: {
      manufacturerId: debouncedManufacturer ? undefined : undefined,
      search: familyFilter,
      first: 8,
    },
    pause: familyFilter.length < 2,
  });
  const familyResults: Array<{ id: string; name: string }> =
    familyData?.aircraftFamilies?.edges?.map(
      (e: { node: { id: string; name: string } }) => e.node,
    ) ?? [];

  // Variant typeahead
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [{ data: variantData, fetching: variantFetching }] = useQuery({
    query: GET_AIRCRAFT_VARIANTS,
    variables: { search: variantFilter, first: 8 },
    pause: variantFilter.length < 2,
  });
  const variantResults: Array<{ id: string; name: string }> =
    variantData?.aircraftVariants?.edges?.map(
      (e: { node: { id: string; name: string } }) => e.node,
    ) ?? [];

  // Click outside to close all dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(`.${styles.filterInputWrap}`)) {
        setShowAirlineDropdown(false);
        setShowAirportDropdown(false);
        setShowPhotographerDropdown(false);
        setShowManufacturerDropdown(false);
        setShowFamilyDropdown(false);
        setShowVariantDropdown(false);
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

  // Single config driving both the active-filter chips and clear-all behavior.
  const filterConfigs: Array<{
    key: string;
    icon: string;
    value: string;
    setValue: (v: string) => void;
    setDebounced: (v: string) => void;
  }> = [
    {
      key: 'airport',
      icon: '🛫',
      value: airportFilter,
      setValue: setAirportFilter,
      setDebounced: setDebouncedAirport,
    },
    {
      key: 'airline',
      icon: '✈️',
      value: airlineFilter,
      setValue: setAirlineFilter,
      setDebounced: setDebouncedAirline,
    },
    {
      key: 'photographer',
      icon: '📷',
      value: photographerFilter,
      setValue: setPhotographerFilter,
      setDebounced: setDebouncedPhotographer,
    },
    {
      key: 'manufacturer',
      icon: '🛩️',
      value: manufacturerFilter,
      setValue: setManufacturerFilter,
      setDebounced: setDebouncedManufacturer,
    },
    {
      key: 'family',
      icon: '✈️',
      value: familyFilter,
      setValue: setFamilyFilter,
      setDebounced: setDebouncedFamily,
    },
    {
      key: 'variant',
      icon: '🔧',
      value: variantFilter,
      setValue: setVariantFilter,
      setDebounced: setDebouncedVariant,
    },
  ];
  const activeFilters = filterConfigs.filter((f) => f.value);
  const clearAllFilters = () =>
    filterConfigs.forEach((f) => {
      f.setValue('');
      f.setDebounced('');
    });

  // Typeahead elements — reused in both desktop row and mobile drawer
  const airportTypeahead = (
    <TypeaheadInput
      icon="🛫"
      placeholder="Airport (e.g. KLAX)"
      value={airportFilter}
      onChange={setAirportFilter}
      showDropdown={showAirportDropdown}
      setShowDropdown={setShowAirportDropdown}
      results={airportResults}
      fetching={airportFetching}
      renderItem={(a) => ({
        key: a.icaoCode,
        label: `${a.name} (${a.icaoCode})${a.city ? ` — ${a.city}` : ''}`,
      })}
      onSelect={(a) => {
        setAirportFilter(a.icaoCode);
        setDebouncedAirport(a.icaoCode);
      }}
      emptyLabel="No airports found"
    />
  );

  const airlineTypeahead = (
    <TypeaheadInput
      icon="✈️"
      placeholder="Airline"
      value={airlineFilter}
      onChange={setAirlineFilter}
      showDropdown={showAirlineDropdown}
      setShowDropdown={setShowAirlineDropdown}
      results={airlineResults}
      fetching={airlineFetching}
      renderItem={(name) => ({ key: name, label: name })}
      onSelect={(name) => {
        setAirlineFilter(name);
        setDebouncedAirline(name);
      }}
      emptyLabel="No airlines found"
    />
  );

  const photographerTypeahead = (
    <TypeaheadInput
      icon="📷"
      placeholder="Photographer"
      value={photographerFilter}
      onChange={setPhotographerFilter}
      showDropdown={showPhotographerDropdown}
      setShowDropdown={setShowPhotographerDropdown}
      results={photographerResults}
      fetching={photographerFetching}
      renderItem={(u) => ({
        key: u.id,
        label: u.profile?.displayName || u.username,
      })}
      onSelect={(u) => {
        const label = u.profile?.displayName || u.username;
        setPhotographerFilter(label);
        setDebouncedPhotographer(label);
      }}
      emptyLabel="No photographers found"
    />
  );

  const manufacturerTypeahead = (
    <TypeaheadInput
      icon="🛩️"
      placeholder="Manufacturer"
      value={manufacturerFilter}
      onChange={(v) => {
        setManufacturerFilter(v);
        // Cascading: clear family + variant when manufacturer changes
        setFamilyFilter('');
        setVariantFilter('');
      }}
      showDropdown={showManufacturerDropdown}
      setShowDropdown={setShowManufacturerDropdown}
      results={manufacturerResults}
      fetching={manufacturerFetching}
      renderItem={(m) => ({ key: m.id, label: m.name })}
      onSelect={(m) => {
        setManufacturerFilter(m.name);
        setDebouncedManufacturer(m.name);
      }}
      emptyLabel="No manufacturers found"
    />
  );

  const familyTypeahead = (
    <TypeaheadInput
      icon="✈️"
      placeholder="Family (e.g. 737)"
      value={familyFilter}
      onChange={setFamilyFilter}
      showDropdown={showFamilyDropdown}
      setShowDropdown={setShowFamilyDropdown}
      results={familyResults}
      fetching={familyFetching}
      renderItem={(f) => ({ key: f.id, label: f.name })}
      onSelect={(f) => {
        setFamilyFilter(f.name);
        setDebouncedFamily(f.name);
      }}
      emptyLabel="No families found"
    />
  );

  const variantTypeahead = (
    <TypeaheadInput
      icon="🔧"
      placeholder="Variant (e.g. 8MAX)"
      value={variantFilter}
      onChange={setVariantFilter}
      showDropdown={showVariantDropdown}
      setShowDropdown={setShowVariantDropdown}
      results={variantResults}
      fetching={variantFetching}
      renderItem={(v) => ({ key: v.id, label: v.name })}
      onSelect={(v) => {
        setVariantFilter(v.name);
        setDebouncedVariant(v.name);
      }}
      emptyLabel="No variants found"
    />
  );

  return (
    <div>
      {/* Hero Banner */}
      <div
        className={styles.hero}
        style={
          siteBannerUrl
            ? {
                backgroundImage: `url(${siteBannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
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

      {feedAdSlot && (
        <div className="container">
          <AdBanner slotId={feedAdSlot} />
        </div>
      )}

      <div className="container">
        {/* Filter Bar */}
        <div className={styles.filterBar}>
          {/* Mobile filter entry: chips + open button (hidden on desktop via CSS) */}
          <div className={styles.filterMobileBar}>
            {activeFilters.length > 0 && (
              <div className={styles.filterChipRow}>
                {activeFilters.map((f) => (
                  <span key={f.key} className={styles.filterChip}>
                    <span>{f.icon}</span>
                    <span>{f.value}</span>
                    <button
                      type="button"
                      className={styles.filterChipRemove}
                      onClick={() => {
                        f.setValue('');
                        f.setDebounced('');
                      }}
                      aria-label={`Remove ${f.key} filter`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.filterMobileBtn}
              onClick={() => setFiltersOpen(true)}
            >
              <span>🔍 Filters</span>
              {activeFilters.length > 0 && (
                <span className={styles.filterMobileBtnBadge}>{activeFilters.length}</span>
              )}
            </button>
          </div>

          {/* Desktop inline filter row */}
          <div className={styles.filterRow}>
            {airportTypeahead}
            {airlineTypeahead}
            {photographerTypeahead}
            {manufacturerTypeahead}
            {familyTypeahead}
            {variantTypeahead}
          </div>

          {/* Sort Pills + View Toggle */}
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
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ▦
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Mobile filter drawer */}
        <FilterDrawer
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={clearAllFilters}>
                Clear all
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setFiltersOpen(false)}
              >
                Show results
              </button>
            </>
          }
        >
          <div className={styles.filterDrawerStack}>
            {airportTypeahead}
            {airlineTypeahead}
            {photographerTypeahead}
            {manufacturerTypeahead}
            {familyTypeahead}
            {variantTypeahead}
          </div>
        </FilterDrawer>

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
              <Link href="/signin">Sign in</Link> to see photos from people, airports, and topics
              you follow.
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
            viewMode={viewMode}
            adSlotId={feedAdSlot ?? undefined}
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
