'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import {
  GET_AIRLINES,
  GET_AIRCRAFT_MANUFACTURERS,
  GET_AIRCRAFT_FAMILIES,
  GET_AIRCRAFT_VARIANTS,
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { user, ready } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('airlines');
  const [search, setSearch] = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────

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
            <Link href="/signin">Sign in</Link> to discover topics.
          </p>
        </div>
      </div>
    );
  }

  // ─── Tab config ───────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string }[] = [
    { key: 'airlines', label: 'Airlines' },
    { key: 'manufacturers', label: 'Manufacturers' },
    { key: 'families', label: 'Families' },
    { key: 'variants', label: 'Variants' },
  ];

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Discover</h1>
          <p className={styles.subtitle}>
            Follow airlines, aircraft families, variants, and manufacturers to
            see related photos in your feed
          </p>
        </div>

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

        {/* Airlines Tab */}
        {activeTab === 'airlines' && (
          <TopicList
            loading={airlinesResult.fetching}
            emptyLabel="No airlines found"
          >
            {airlinesResult.data?.airlines?.edges?.map(
              (e: { node: AirlineNode }) => (
                <TopicRow
                  key={e.node.id}
                  name={e.node.name}
                  meta={
                    [e.node.icaoCode, e.node.iataCode].filter(Boolean).join(' / ') +
                    (e.node.country ? ` · ${e.node.country}` : '')
                  }
                  targetType="airline"
                  value={e.node.icaoCode ?? e.node.name}
                  isFollowedByMe={e.node.isFollowedByMe}
                />
              ),
            )}
          </TopicList>
        )}

        {/* Manufacturers Tab */}
        {activeTab === 'manufacturers' && (
          <TopicList
            loading={manufacturersResult.fetching}
            emptyLabel="No manufacturers found"
          >
            {manufacturersResult.data?.aircraftManufacturers?.edges?.map(
              (e: { node: ManufacturerNode }) => (
                <TopicRow
                  key={e.node.id}
                  name={e.node.name}
                  meta={e.node.country ?? undefined}
                  targetType="manufacturer"
                  value={e.node.name}
                  isFollowedByMe={e.node.isFollowedByMe}
                />
              ),
            )}
          </TopicList>
        )}

        {/* Families Tab */}
        {activeTab === 'families' && (
          <TopicList
            loading={familiesResult.fetching}
            emptyLabel="No families found"
          >
            {familiesResult.data?.aircraftFamilies?.edges?.map(
              (e: { node: FamilyNode }) => (
                <TopicRow
                  key={e.node.id}
                  name={e.node.name}
                  meta={`By ${e.node.manufacturer.name}`}
                  targetType="family"
                  value={e.node.name}
                  isFollowedByMe={e.node.isFollowedByMe}
                />
              ),
            )}
          </TopicList>
        )}

        {/* Variants Tab */}
        {activeTab === 'variants' && (
          <TopicList
            loading={variantsResult.fetching}
            emptyLabel="No variants found"
          >
            {variantsResult.data?.aircraftVariants?.edges?.map(
              (e: { node: VariantNode }) => (
                <TopicRow
                  key={e.node.id}
                  name={e.node.name}
                  meta={
                    [e.node.iataCode, e.node.icaoCode].filter(Boolean).join(' / ') +
                    ` · ${e.node.family.name}`
                  }
                  targetType="variant"
                  value={e.node.name}
                  isFollowedByMe={e.node.isFollowedByMe}
                />
              ),
            )}
          </TopicList>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopicList({
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
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🔍</div>
        <p className={styles.emptyText}>{emptyLabel}</p>
      </div>
    );
  }

  return <div className={styles.list}>{children}</div>;
}

interface TopicRowProps {
  name: string;
  meta?: string | null;
  targetType: 'airline' | 'manufacturer' | 'family' | 'variant';
  value: string;
  isFollowedByMe: boolean;
}

function TopicRow({ name, meta, targetType, value, isFollowedByMe }: TopicRowProps) {
  return (
    <div className={styles.listItem}>
      <div className={styles.itemInfo}>
        <div className={styles.itemIcon}>✈️</div>
        <div className={styles.itemDetails}>
          <div className={styles.itemName}>{name}</div>
          {meta && <div className={styles.itemMeta}>{meta}</div>}
        </div>
      </div>
      <TopicFollowButton
        targetType={targetType}
        value={value}
        initialIsFollowing={isFollowedByMe}
      />
    </div>
  );
}
