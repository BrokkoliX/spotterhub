'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useCommunitiesQuery } from '@/lib/generated/graphql';

import styles from './page.module.css';

const PAGE_SIZE = 20;

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'airliners', label: 'Airliners' },
  { value: 'military', label: 'Military' },
  { value: 'general-aviation', label: 'General Aviation' },
  { value: 'helicopters', label: 'Helicopters' },
  { value: 'general', label: 'General' },
];

export default function CommunitiesPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const [{ data, fetching }] = useCommunitiesQuery({
    variables: {
      search: search || undefined,
      category: category || undefined,
      first: PAGE_SIZE,
    },
    requestPolicy: 'cache-and-network',
  });

  const communities = data?.communities;

  // Featured community = the one with most members (first in sorted-by-members list)
  const featuredCommunity = communities?.edges?.[0]?.node;

  return (
    <div>
      {/* Hero Banner */}
      <div className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroEmoji}>🌍</div>
          <h1 className={styles.heroTitle}>Communities</h1>
          <p className={styles.heroSubtitle}>
            Join aviation spotting communities around the world
          </p>
        </div>
      </div>

      <div className="container">
        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterRow}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search communities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {ready && user && (
              <Link href="/communities/new" className="btn btn-primary">
                + New
              </Link>
            )}
          </div>
        </div>

        {/* Featured community */}
        {featuredCommunity && !search && !category && (
          <div className={styles.featuredWrap}>
            <Link href={`/communities/${featuredCommunity.slug}`} className={styles.featuredCard}>
              <div className={styles.featuredBanner} />
              <div className={styles.featuredBody}>
                <div className={styles.featuredBadge}>⭐ Featured</div>
                <div className={styles.featuredAvatar}>
                  {featuredCommunity.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.featuredName}>{featuredCommunity.name}</div>
                {featuredCommunity.description && (
                  <div className={styles.featuredDesc}>{featuredCommunity.description}</div>
                )}
                <div className={styles.featuredMeta}>
                  <span>👥 {featuredCommunity.memberCount} members</span>
                  {featuredCommunity.category && <span>📂 {featuredCommunity.category}</span>}
                  {featuredCommunity.location && <span>📍 {featuredCommunity.location}</span>}
                </div>
              </div>
            </Link>
          </div>
        )}

        {fetching && <div className={styles.loading}>Loading…</div>}

        {communities && communities.edges.length > 0 && (
          <div className={styles.grid}>
            {(search || category
              ? communities.edges
              : communities.edges.slice(1) // skip featured (first)
            ).map(({ node }) => (
              <Link href={`/communities/${node.slug}`} key={node.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardAvatar}>
                    {node.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className={styles.cardName}>{node.name}</div>
                    <div className={styles.cardSlug}>/{node.slug}</div>
                  </div>
                </div>
                {node.description && (
                  <div className={styles.cardDesc}>{node.description}</div>
                )}
                <div className={styles.cardMeta}>
                  <span>👥 {node.memberCount} member{node.memberCount !== 1 ? 's' : ''}</span>
                  {node.category && <span>📂 {node.category}</span>}
                  <span>by {node.owner.username}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {communities && communities.edges.length === 0 && !fetching && (
          <div className={styles.empty}>
            No communities found.{' '}
            {ready && user ? (
              <Link href="/communities/new">Create the first one!</Link>
            ) : 'Sign in to create one.'}
          </div>
        )}

        {communities?.pageInfo?.hasNextPage && (
          <button className={`btn btn-secondary ${styles.loadMore}`}>Load more</button>
        )}
      </div>
    </div>
  );
}
