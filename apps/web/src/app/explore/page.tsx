'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from 'urql';
import { Suspense } from 'react';

import { useAuth } from '@/lib/auth';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import {
  GET_AIRLINES,
  GET_AIRCRAFT_MANUFACTURERS,
  GET_AIRCRAFT_FAMILIES,
  GET_AIRCRAFT_VARIANTS,
  GET_PHOTOS,
} from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabType = 'airlines' | 'manufacturers' | 'families' | 'variants';

interface AirlineNode {
  id: string;
  name: string;
  icaoCode: string | null;
  iataCode: string | null;
  country: string | null;
  isFollowedByMe: boolean;
}

interface ManufacturerNode {
  id: string;
  name: string;
  country: string | null;
  isFollowedByMe: boolean;
}

interface FamilyNode {
  id: string;
  name: string;
  isFollowedByMe: boolean;
  manufacturer: { id: string; name: string };
}

interface VariantNode {
  id: string;
  name: string;
  iataCode: string | null;
  icaoCode: string | null;
  isFollowedByMe: boolean;
  family: { id: string; name: string };
}

interface SelectedEntity {
  type: TabType;
  name: string;
  value: string;
}

const PAGE_SIZE = 24;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className="container"><p>Loading…</p></div></div>}>
      <ExplorePageInner />
    </Suspense>
  );
}

function ExplorePageInner() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>('airlines');
  const [search, setSearch] = useState('');

  // Read selected entity from URL params
  const selectedType = (searchParams.get('type') as TabType) ?? null;
  const selectedValue = searchParams.get('value') ?? null;
  const selectedName = searchParams.get('name') ?? null;

  // Build photo filter from selected entity
  const photoFilter = selectedType && selectedValue
    ? getPhotoFilter(selectedType, selectedValue)
    : null;

  // ─── Photo query ──────────────────────────────────────────────────────────

  const [{ data: photoData, fetching: photoFetching }] = useQuery({
    query: GET_PHOTOS,
    variables: {
      first: PAGE_SIZE,
      ...(photoFilter ?? {}),
    },
    pause: !user || !photoFilter,
  });

  const displayedPhotos: PhotoData[] =
    photoData?.photos?.edges?.map((e: { node: PhotoData }) => e.node) ?? [];

  // ─── Entity queries ────────────────────────────────────────────────────────

  const [airlinesResult] = useQuery({
    query: GET_AIRLINES,
    variables: { search: search || undefined, first: 50 },
    pause: !user || activeTab !== 'airlines',
  });

  const [manufacturersResult] = useQuery({
    query: GET_AIRCRAFT_MANUFACTURERS,
    variables: { search: search || undefined, first: 50 },
    pause: !user || activeTab !== 'manufacturers',
  });

  const [familiesResult] = useQuery({
    query: GET_AIRCRAFT_FAMILIES,
    variables: { search: search || undefined, first: 50 },
    pause: !user || activeTab !== 'families',
  });

  const [variantsResult] = useQuery({
    query: GET_AIRCRAFT_VARIANTS,
    variables: { search: search || undefined, first: 50 },
    pause: !user || activeTab !== 'variants',
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────

  if (ready && !user) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.signInPrompt}>
            <Link href="/signin">Sign in</Link> to explore and follow topics.
          </p>
        </div>
      </div>
    );
  }

  // ─── Entity selection ──────────────────────────────────────────────────────

  function selectEntity(type: TabType, name: string, value: string) {
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('value', value);
    params.set('name', name);
    router.push(`/explore?${params.toString()}`);
  }

  function clearSelection() {
    router.push('/explore');
  }

  // ─── Tab config ───────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string }[] = [
    { key: 'airlines', label: 'Airlines' },
    { key: 'manufacturers', label: 'Manufacturers' },
    { key: 'families', label: 'Families' },
    { key: 'variants', label: 'Variants' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Explore</h1>
          <p className={styles.subtitle}>
            Browse airlines, aircraft families, variants, and manufacturers — follow any to see their photos in your feed
          </p>
        </div>

        <div className={styles.layout}>
          {/* Left: Entity list */}
          <div className={styles.sidebar}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Entity list */}
            <div className={styles.entityList}>
              {activeTab === 'airlines' && (
                <EntityList
                  loading={airlinesResult.fetching}
                  emptyLabel="No airlines found"
                >
                  {airlinesResult.data?.airlines?.edges?.map(
                    (e: { node: AirlineNode }) => (
                      <EntityRow
                        key={e.node.id}
                        name={e.node.name}
                        meta={
                          [e.node.icaoCode, e.node.iataCode].filter(Boolean).join(' / ') +
                          (e.node.country ? ` · ${e.node.country}` : '')
                        }
                        targetType="airline"
                        value={e.node.icaoCode ?? e.node.name}
                        isFollowedByMe={e.node.isFollowedByMe}
                        isSelected={selectedType === 'airlines' && selectedValue === (e.node.icaoCode ?? e.node.name)}
                        onSelect={() => selectEntity('airlines', e.node.name, e.node.icaoCode ?? e.node.name)}
                      />
                    ),
                  )}
                </EntityList>
              )}

              {activeTab === 'manufacturers' && (
                <EntityList
                  loading={manufacturersResult.fetching}
                  emptyLabel="No manufacturers found"
                >
                  {manufacturersResult.data?.aircraftManufacturers?.edges?.map(
                    (e: { node: ManufacturerNode }) => (
                      <EntityRow
                        key={e.node.id}
                        name={e.node.name}
                        meta={e.node.country ?? undefined}
                        targetType="manufacturer"
                        value={e.node.name}
                        isFollowedByMe={e.node.isFollowedByMe}
                        isSelected={selectedType === 'manufacturers' && selectedValue === e.node.name}
                        onSelect={() => selectEntity('manufacturers', e.node.name, e.node.name)}
                      />
                    ),
                  )}
                </EntityList>
              )}

              {activeTab === 'families' && (
                <EntityList
                  loading={familiesResult.fetching}
                  emptyLabel="No families found"
                >
                  {familiesResult.data?.aircraftFamilies?.edges?.map(
                    (e: { node: FamilyNode }) => (
                      <EntityRow
                        key={e.node.id}
                        name={e.node.name}
                        meta={`By ${e.node.manufacturer.name}`}
                        targetType="family"
                        value={e.node.name}
                        isFollowedByMe={e.node.isFollowedByMe}
                        isSelected={selectedType === 'families' && selectedValue === e.node.name}
                        onSelect={() => selectEntity('families', e.node.name, e.node.name)}
                      />
                    ),
                  )}
                </EntityList>
              )}

              {activeTab === 'variants' && (
                <EntityList
                  loading={variantsResult.fetching}
                  emptyLabel="No variants found"
                >
                  {variantsResult.data?.aircraftVariants?.edges?.map(
                    (e: { node: VariantNode }) => (
                      <EntityRow
                        key={e.node.id}
                        name={e.node.name}
                        meta={
                          [e.node.iataCode, e.node.icaoCode].filter(Boolean).join(' / ') +
                          ` · ${e.node.family.name}`
                        }
                        targetType="variant"
                        value={e.node.name}
                        isFollowedByMe={e.node.isFollowedByMe}
                        isSelected={selectedType === 'variants' && selectedValue === e.node.name}
                        onSelect={() => selectEntity('variants', e.node.name, e.node.name)}
                      />
                    ),
                  )}
                </EntityList>
              )}
            </div>
          </div>

          {/* Right: Photo grid */}
          <div className={styles.main}>
            {!selectedType ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✈️</div>
                <p className={styles.emptyText}>Select an entity to see its photos</p>
                <p className={styles.emptySub}>
                  Click any airline, manufacturer, family, or variant on the left to browse photos
                </p>
              </div>
            ) : (
              <>
                <div className={styles.feedHeader}>
                  <button type="button" className={styles.backBtn} onClick={clearSelection}>
                    ← Back to list
                  </button>
                  <h2 className={styles.feedTitle}>
                    {selectedName}
                  </h2>
                </div>
                {photoFetching ? (
                  <p className={styles.loading}>Loading photos…</p>
                ) : displayedPhotos.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📷</div>
                    <p className={styles.emptyText}>No photos yet for {selectedName}</p>
                    <p className={styles.emptySub}>Be the first to upload one!</p>
                  </div>
                ) : (
                  <PhotoGrid
                    photos={displayedPhotos}
                    hasNextPage={false}
                    loading={false}
                    onLoadMore={() => {}}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getPhotoFilter(type: TabType, value: string): Record<string, unknown> {
  switch (type) {
    case 'airlines':
      return { airline: value };
    case 'manufacturers':
      return { manufacturer: value };
    case 'families':
      return { family: value };
    case 'variants':
      return { variant: value };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EntityList({
  loading,
  emptyLabel,
  children,
}: {
  loading: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const childArray = Array.isArray(children) ? children : children ? [children] : [];

  if (childArray.length === 0) {
    return (
      <div className={styles.emptyEntityList}>
        <p className={styles.emptyEntityListText}>{emptyLabel}</p>
      </div>
    );
  }

  return <div className={styles.list}>{children}</div>;
}

interface EntityRowProps {
  name: string;
  meta?: string | null;
  targetType: 'airline' | 'manufacturer' | 'family' | 'variant';
  value: string;
  isFollowedByMe: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function EntityRow({
  name,
  meta,
  targetType,
  value,
  isFollowedByMe,
  isSelected,
  onSelect,
}: EntityRowProps) {
  return (
    <div
      className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.itemInfo}>
        <div className={styles.itemIcon}>✈️</div>
        <div className={styles.itemDetails}>
          <div className={styles.itemName}>{name}</div>
          {meta && <div className={styles.itemMeta}>{meta}</div>}
        </div>
      </div>
      <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
        <TopicFollowButton
          targetType={targetType}
          value={value}
          initialIsFollowing={isFollowedByMe}
        />
      </div>
    </div>
  );
}
