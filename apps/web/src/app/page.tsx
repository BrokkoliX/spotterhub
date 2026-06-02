'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { AdBanner } from '@/components/AdBanner';
import { CommunityFeedBlock } from '@/components/CommunityFeedBlock';
import { FilterDrawer } from '@/components/FilterDrawer';
import { InfinitePhotoGrid } from '@/components/InfinitePhotoGrid';
import { useAuth } from '@/lib/auth';
import { useResponsiveSplitIndex } from '@/lib/useResponsiveSplitIndex';
import {
  GET_AIRCRAFT_FAMILIES,
  GET_AIRCRAFT_MANUFACTURERS,
  GET_AIRCRAFT_VARIANTS,
  GET_FOLLOWING_FEED,
  GET_PHOTOS,
  GET_RANDOM_PHOTO,
  GET_SITE_SETTINGS,
  GET_AD_SETTINGS,
  SEARCH_AIRLINES,
  SEARCH_AIRPORTS,
  SEARCH_USERS,
} from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 24;

/**
 * Slug of the badge that powers the "Admin's Choice" feed tab. Stays in
 * sync with apps/web/src/components/AdminChoiceButton.tsx — keep the two
 * in lockstep if the slug ever changes.
 */
const ADMIN_CHOICE_BADGE_SLUG = 'admin-choice-week';

type FeedTab = 'recent' | 'following' | 'mine' | 'admin_choice';
type SortOption =
  | 'recent'
  | 'popular_day'
  | 'popular_week'
  | 'popular_month'
  | 'popular_all'
  | 'random';

const SORT_OPTIONS: { value: SortOption; label: string; emoji: string }[] = [
  { value: 'recent', label: 'Recent', emoji: '🕐' },
  { value: 'popular_day', label: 'Today', emoji: '⭐' },
  { value: 'popular_week', label: 'This Week', emoji: '🔥' },
  { value: 'popular_month', label: 'This Month', emoji: '🚀' },
  { value: 'popular_all', label: 'All Time', emoji: '🏆' },
  { value: 'random', label: 'Random', emoji: '🎲' },
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
  const hasValue = value.length > 0;
  return (
    <div className={styles.filterInputWrap}>
      <span className={styles.filterIcon}>{icon}</span>
      <input
        type="text"
        className={`${styles.filterInput} ${hasValue ? styles.filterInputHasValue : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(e.target.value.length >= minChars);
        }}
        onFocus={() => meetsMin && setShowDropdown(true)}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 150);
        }}
      />
      {hasValue && (
        <button
          type="button"
          className={styles.filterClear}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('');
            setShowDropdown(false);
          }}
          aria-label="Clear"
        >
          ✕
        </button>
      )}
      {showDropdown && (results.length > 0 || (fetching && meetsMin)) && (
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
                  onMouseDown={(e) => e.preventDefault()}
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

// ─── Per-tab state for infinite scroll ───────────────────────────────────────

interface TabState {
  photos: PhotoData[];
  endCursor: string | null;
  hasNextPage: boolean;
}

export default function HomePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [feedTab, setFeedTab] = useState<FeedTab>('recent');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [kindFilter, setKindFilter] = useState<'all' | 'AIRCRAFT' | 'COMMUNITY'>('all');
  const [airportFilter, setAirportFilter] = useState('');
  const [airlineFilter, setAirlineFilter] = useState('');
  const [photographerFilter, setPhotographerFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string | undefined>(
    undefined,
  );
  const [familyFilter, setFamilyFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');
  const [debouncedAirport, setDebouncedAirport] = useState('');
  const [debouncedAirline, setDebouncedAirline] = useState('');
  const [debouncedPhotographer, setDebouncedPhotographer] = useState('');
  const [debouncedManufacturer, setDebouncedManufacturer] = useState('');
  const [debouncedFamily, setDebouncedFamily] = useState('');
  const [debouncedVariant, setDebouncedVariant] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const splitIndex = useResponsiveSplitIndex();

  // Per-tab infinite scroll state
  const [recentState, setRecentState] = useState<TabState>({
    photos: [],
    endCursor: null,
    hasNextPage: true,
  });
  const [followingState, setFollowingState] = useState<TabState>({
    photos: [],
    endCursor: null,
    hasNextPage: true,
  });
  const [mineState, setMineState] = useState<TabState>({
    photos: [],
    endCursor: null,
    hasNextPage: true,
  });
  const [adminChoiceState, setAdminChoiceState] = useState<TabState>({
    photos: [],
    endCursor: null,
    hasNextPage: true,
  });

  // Total count per tab (for display purposes, not for pagination)
  const [recentTotalCount, setRecentTotalCount] = useState(0);

  // Track which tab has been initialized (so we don't re-fetch on tab re-select)
  const initializedTabs = useRef<Set<FeedTab>>(new Set(['recent']));

  const [{ data: siteData }] = useQuery({ query: GET_SITE_SETTINGS });
  const [{ data: adData }] = useQuery({ query: GET_AD_SETTINGS });

  // Hero photo
  const [{ data: randomPhotoData }] = useQuery({
    query: GET_RANDOM_PHOTO,
    requestPolicy: 'network-only',
  });
  const heroPhoto = randomPhotoData?.randomPhoto as PhotoData | null | undefined;
  const heroDisplayVariant = heroPhoto?.variants?.find(
    (v: { variantType: string }) => v.variantType === 'display',
  );
  const heroFallbackVariant = heroPhoto?.variants?.find(
    (v: { variantType: string }) => v.variantType === 'thumbnail',
  );
  const heroImageUrl =
    heroDisplayVariant?.url ?? heroFallbackVariant?.url ?? heroPhoto?.originalUrl ?? null;

  const siteBannerUrl = siteData?.siteSettings?.bannerUrl;
  const siteTagline = siteData?.siteSettings?.tagline;
  const feedAdSlot = adData?.adSettings?.slotFeed ?? null;

  // Debounce timers
  const airportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const airlineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const photographerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manufacturerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const familyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const variantTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(airportTimer.current);
    airportTimer.current = setTimeout(() => setDebouncedAirport(airportFilter), 300);
    return () => clearTimeout(airportTimer.current);
  }, [airportFilter]);

  useEffect(() => {
    clearTimeout(airlineTimer.current);
    airlineTimer.current = setTimeout(() => setDebouncedAirline(airlineFilter), 300);
    return () => clearTimeout(airlineTimer.current);
  }, [airlineFilter]);

  useEffect(() => {
    clearTimeout(photographerTimer.current);
    photographerTimer.current = setTimeout(() => setDebouncedPhotographer(photographerFilter), 300);
    return () => clearTimeout(photographerTimer.current);
  }, [photographerFilter]);

  useEffect(() => {
    clearTimeout(manufacturerTimer.current);
    manufacturerTimer.current = setTimeout(() => setDebouncedManufacturer(manufacturerFilter), 300);
    return () => clearTimeout(manufacturerTimer.current);
  }, [manufacturerFilter]);

  useEffect(() => {
    clearTimeout(familyTimer.current);
    familyTimer.current = setTimeout(() => setDebouncedFamily(familyFilter), 300);
    return () => clearTimeout(photographerTimer.current);
  }, [familyFilter]);

  useEffect(() => {
    clearTimeout(variantTimer.current);
    variantTimer.current = setTimeout(() => setDebouncedVariant(variantFilter), 300);
    return () => clearTimeout(variantTimer.current);
  }, [variantFilter]);

  // ─── Build cursor-based variables per tab ───────────────────────────────────

  const recentVars = useMemo(
    () => ({
      first: PAGE_SIZE,
      after: recentState.endCursor,
      airportCode: debouncedAirport || undefined,
      airline: debouncedAirline || undefined,
      photographer: debouncedPhotographer || undefined,
      manufacturer: debouncedManufacturer || undefined,
      family: debouncedFamily || undefined,
      variant: debouncedVariant || undefined,
      kind: kindFilter !== 'all' ? kindFilter : undefined,
      sortBy: sortBy !== 'recent' ? sortBy : undefined,
    }),
    [
      debouncedAirport,
      debouncedAirline,
      debouncedPhotographer,
      debouncedManufacturer,
      debouncedFamily,
      debouncedVariant,
      sortBy,
      kindFilter,
      recentState.endCursor,
    ],
  );

  const followingVars = useMemo(
    () => ({ first: PAGE_SIZE, after: followingState.endCursor }),
    [followingState.endCursor],
  );

  const mineVars = useMemo(
    () => ({ first: PAGE_SIZE, after: mineState.endCursor, userId: user?.id }),
    [mineState.endCursor, user?.id],
  );

  const adminChoiceVars = useMemo(
    () => ({
      first: PAGE_SIZE,
      after: adminChoiceState.endCursor,
      awardSlug: ADMIN_CHOICE_BADGE_SLUG,
    }),
    [adminChoiceState.endCursor],
  );

  // ─── Queries ────────────────────────────────────────────────────────────────

  const [{ data: recentData, fetching: recentFetching }, reexecuteRecent] = useQuery({
    query: GET_PHOTOS,
    variables: recentVars,
    pause: feedTab !== 'recent',
  });

  const [{ data: followingData, fetching: followingFetching }] = useQuery({
    query: GET_FOLLOWING_FEED,
    variables: followingVars,
    pause: feedTab !== 'following' || !user,
  });

  const [{ data: mineData, fetching: mineFetching }] = useQuery({
    query: GET_PHOTOS,
    variables: mineVars,
    pause: feedTab !== 'mine' || !user,
  });

  const [{ data: adminChoiceData, fetching: adminChoiceFetching }] = useQuery({
    query: GET_PHOTOS,
    variables: adminChoiceVars,
    pause: feedTab !== 'admin_choice',
  });

  // ─── Sync: when query results come in, update tab state ─────────────────────

  // Recent tab
  useEffect(() => {
    if (feedTab !== 'recent') return;
    const conn = recentData?.photos;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const endCursor = conn.pageInfo?.endCursor ?? null;
    const hasNextPage = conn.pageInfo?.hasNextPage ?? false;

    // On first fetch (no cursor yet), replace. On subsequent, append.
    setRecentState((prev) =>
      prev.endCursor === null
        ? { photos: newPhotos, endCursor, hasNextPage }
        : {
            photos: [...prev.photos, ...newPhotos],
            endCursor,
            hasNextPage,
          },
    );
    setRecentTotalCount(conn.totalCount ?? 0);
  }, [recentData, feedTab]);

  // Following tab
  useEffect(() => {
    if (feedTab !== 'following') return;
    const conn = followingData?.followingFeed;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const endCursor = conn.pageInfo?.endCursor ?? null;
    const hasNextPage = conn.pageInfo?.hasNextPage ?? false;

    setFollowingState((prev) =>
      prev.endCursor === null
        ? { photos: newPhotos, endCursor, hasNextPage }
        : {
            photos: [...prev.photos, ...newPhotos],
            endCursor,
            hasNextPage,
          },
    );
  }, [followingData, feedTab]);

  // Mine tab
  useEffect(() => {
    if (feedTab !== 'mine') return;
    const conn = mineData?.photos;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const endCursor = conn.pageInfo?.endCursor ?? null;
    const hasNextPage = conn.pageInfo?.hasNextPage ?? false;

    setMineState((prev) =>
      prev.endCursor === null
        ? { photos: newPhotos, endCursor, hasNextPage }
        : {
            photos: [...prev.photos, ...newPhotos],
            endCursor,
            hasNextPage,
          },
    );
  }, [mineData, feedTab]);

  // Admin choice tab
  useEffect(() => {
    if (feedTab !== 'admin_choice') return;
    const conn = adminChoiceData?.photos;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const endCursor = conn.pageInfo?.endCursor ?? null;
    const hasNextPage = conn.pageInfo?.hasNextPage ?? false;

    setAdminChoiceState((prev) =>
      prev.endCursor === null
        ? { photos: newPhotos, endCursor, hasNextPage }
        : {
            photos: [...prev.photos, ...newPhotos],
            endCursor,
            hasNextPage,
          },
    );
  }, [adminChoiceData, feedTab]);

  // ─── Load more handler ───────────────────────────────────────────────────────

  const handleLoadMore = useCallback(
    (tab: FeedTab) => (after: string | null) => {
      // Just re-execute the query with the new cursor.
      // urql's cache will handle appending the results, and the useEffect above
      // will sync the accumulated state.
      switch (tab) {
        case 'recent':
          reexecuteRecent({ requestPolicy: 'network-only' });
          break;
        case 'following':
          // following feed doesn't use cursor pagination in the same way
          break;
        case 'mine':
          // handled by mineVars
          break;
        case 'admin_choice':
          // handled by adminChoiceVars
          break;
      }
    },
    [reexecuteRecent],
  );

  // ─── Tab switch: reset state when switching tabs ───────────────────────────

  const handleTabChange = useCallback((tab: FeedTab) => {
    setFeedTab(tab);
    if (!initializedTabs.current.has(tab)) {
      initializedTabs.current.add(tab);
    }
  }, []);

  // ─── Active tab state ───────────────────────────────────────────────────────

  const activeState =
    feedTab === 'recent'
      ? recentState
      : feedTab === 'following'
        ? followingState
        : feedTab === 'mine'
          ? mineState
          : adminChoiceState;

  const activeFetching =
    feedTab === 'recent'
      ? recentFetching
      : feedTab === 'following'
        ? followingFetching
        : feedTab === 'admin_choice'
          ? adminChoiceFetching
          : mineFetching;

  // ─── Filter configs ─────────────────────────────────────────────────────────

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
  const clearAllFilters = () => {
    filterConfigs.forEach((f) => {
      f.setValue('');
      f.setDebounced('');
    });
    setSelectedManufacturerId(undefined);
    setKindFilter('all');
  };

  // ─── Typeahead elements ──────────────────────────────────────────────────────

  const [showAirlineDropdown, setShowAirlineDropdown] = useState(false);
  const [{ data: airlineData, fetching: airlineFetching }] = useQuery({
    query: SEARCH_AIRLINES,
    variables: { query: airlineFilter, first: 8 },
    pause: airlineFilter.length < 2,
  });
  const airlineResults: string[] = airlineData?.searchAirlines ?? [];

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

  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [{ data: familyData, fetching: familyFetching }] = useQuery({
    query: GET_AIRCRAFT_FAMILIES,
    variables: { manufacturerId: selectedManufacturerId, search: familyFilter, first: 8 },
    pause: familyFilter.length < 2,
  });
  const familyResults: Array<{ id: string; name: string }> =
    familyData?.aircraftFamilies?.edges?.map(
      (e: { node: { id: string; name: string } }) => e.node,
    ) ?? [];

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
      renderItem={(u) => ({ key: u.id, label: u.profile?.displayName || u.username })}
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
        setSelectedManufacturerId(undefined);
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
        setSelectedManufacturerId(m.id);
        setFamilyFilter('');
        setVariantFilter('');
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

  const heroBackgroundUrl = heroImageUrl ?? siteBannerUrl ?? null;
  const heroIsTall = !!heroImageUrl;
  const heroPhotoOwnerName =
    heroPhoto?.user?.profile?.displayName ?? heroPhoto?.user?.username ?? null;

  return (
    <div>
      {/* Hero Banner */}
      <div
        className={`${styles.hero} ${heroIsTall ? styles.heroTall : ''}`}
        style={
          heroBackgroundUrl
            ? {
                backgroundImage: `url(${heroBackgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {heroBackgroundUrl && <div className={styles.heroBannerOverlay} />}
        {!heroBackgroundUrl && <div className={styles.heroGradient} />}
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>SpotterSpace</h1>
          {siteTagline && <p className={styles.heroSubtitle}>{siteTagline}</p>}
        </div>
        {heroPhoto && heroPhotoOwnerName && (
          <Link
            href={`/photos/${heroPhoto.id}`}
            className={styles.heroAttribution}
            title={`View photo by ${heroPhotoOwnerName}`}
          >
            📸 {heroPhotoOwnerName}
          </Link>
        )}
      </div>

      {feedAdSlot && (
        <div className="container">
          <AdBanner slotId={feedAdSlot} />
        </div>
      )}

      <div className="container">
        {/* Filter Bar */}
        <div className={styles.filterBar}>
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

          <div className={styles.filterRow}>
            {airportTypeahead}
            {airlineTypeahead}
            {photographerTypeahead}
            {manufacturerTypeahead}
            {familyTypeahead}
            {variantTypeahead}
          </div>

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
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  marginBottom: 6,
                }}
              >
                Photo type
              </label>
              <div
                role="tablist"
                aria-label="Photo type"
                style={{
                  display: 'flex',
                  gap: 4,
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 4,
                }}
              >
                {(
                  [
                    { value: 'all', label: 'All' },
                    { value: 'AIRCRAFT', label: 'Aircraft' },
                    { value: 'COMMUNITY', label: 'Community' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={kindFilter === opt.value}
                    onClick={() => setKindFilter(opt.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      background: kindFilter === opt.value ? 'var(--color-bg)' : 'transparent',
                      color:
                        kindFilter === opt.value ? 'var(--color-text)' : 'var(--color-text-muted)',
                      boxShadow: kindFilter === opt.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
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
          {user && (
            <button
              type="button"
              className={`${styles.tab} ${feedTab === 'mine' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('mine')}
            >
              My Photos
            </button>
          )}
          <button
            type="button"
            className={`${styles.tab} ${feedTab === 'admin_choice' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('admin_choice')}
            title="Photos hand-picked by site admins"
          >
            🏆 Admin&apos;s Choice
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
        {(feedTab === 'recent' || feedTab === 'admin_choice' || user) &&
          (() => {
            const emptyMessage =
              feedTab === 'following'
                ? 'No photos yet. Follow users, airports, or topics to build your feed!'
                : feedTab === 'mine'
                  ? "You haven't published any photos yet. Head to Upload to share your first shot!"
                  : feedTab === 'admin_choice'
                    ? "No Admin's Choice photos have been awarded yet — check back soon."
                    : activeState.photos.length === 0 && !activeFetching
                      ? 'No photos match your filters.'
                      : undefined;

            const showCommunityBlock = feedTab === 'recent' && activeState.photos.length > 0;

            if (!showCommunityBlock) {
              return (
                <InfinitePhotoGrid
                  key={`${feedTab}`}
                  photos={activeState.photos}
                  endCursor={activeState.endCursor}
                  hasNextPage={activeState.hasNextPage}
                  onLoadMore={handleLoadMore(feedTab)}
                  loading={activeFetching}
                  viewMode={viewMode}
                  adSlotId={feedAdSlot ?? undefined}
                  emptyMessage={emptyMessage ?? 'No photos yet'}
                />
              );
            }

            // Split-rendering with community block
            const headPhotos = activeState.photos.slice(0, splitIndex);
            const tailPhotos = activeState.photos.slice(splitIndex);
            const hasTail = tailPhotos.length > 0;

            return (
              <>
                <InfinitePhotoGrid
                  key={`${feedTab}-head`}
                  photos={headPhotos}
                  endCursor={null}
                  hasNextPage={false}
                  onLoadMore={() => {}}
                  loading={false}
                  viewMode={viewMode}
                  adSlotId={feedAdSlot ?? undefined}
                  emptyMessage={undefined}
                />
                <CommunityFeedBlock />
                {hasTail && (
                  <InfinitePhotoGrid
                    key={`${feedTab}-tail`}
                    photos={tailPhotos}
                    endCursor={activeState.endCursor}
                    hasNextPage={activeState.hasNextPage}
                    onLoadMore={handleLoadMore(feedTab)}
                    loading={activeFetching}
                    viewMode={viewMode}
                    adSlotId={feedAdSlot ?? undefined}
                  />
                )}
              </>
            );
          })()}
      </div>
    </div>
  );
}
