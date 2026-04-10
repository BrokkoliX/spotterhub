'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_COMMUNITIES } from '@/lib/queries';

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

  const [{ data, fetching }] = useQuery({
    query: GET_COMMUNITIES,
    variables: {
      search: search || undefined,
      category: category || undefined,
      first: PAGE_SIZE,
    },
    requestPolicy: 'cache-and-network',
  });

  const communities = data?.communities;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Communities</h1>

      <div className={styles.topBar}>
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
            Create Community
          </Link>
        )}
      </div>

      {fetching && <div className={styles.loading}>Loading…</div>}

      {communities && communities.edges.length > 0 && (
        <div className={styles.grid}>
          {communities.edges.map(({ node }: { node: any }) => (
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
                {node.location && <span>📍 {node.location}</span>}
                <span>by {node.owner.username}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {communities && communities.edges.length === 0 && !fetching && (
        <div className={styles.empty}>
          No communities found. {ready && user ? (
            <Link href="/communities/new">Create the first one!</Link>
          ) : 'Sign in to create one.'}
        </div>
      )}

      {communities?.pageInfo?.hasNextPage && (
        <button className={`btn btn-secondary ${styles.loadMore}`}>Load more</button>
      )}
    </div>
  );
}
