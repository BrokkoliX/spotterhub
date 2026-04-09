'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { AirportFollowButton } from '@/components/AirportFollowButton';
import { FollowButton } from '@/components/FollowButton';
import { TopicFollowButton } from '@/components/TopicFollowButton';
import { GET_MY_FOLLOWING } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabType = 'users' | 'airports' | 'topics';

interface FollowEntry {
  id: string;
  targetType: string;
  user?: {
    id: string;
    username: string;
    isFollowedByMe: boolean;
    profile?: {
      displayName?: string | null;
      avatarUrl?: string | null;
    } | null;
  } | null;
  airport?: {
    id: string;
    icaoCode: string;
    iataCode?: string | null;
    name: string;
    city?: string | null;
    country?: string | null;
    isFollowedByMe: boolean;
    followerCount: number;
  } | null;
  targetValue?: string | null;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FollowingPage() {
  const { user, ready } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('users');

  const [result] = useQuery({
    query: GET_MY_FOLLOWING,
    variables: {},
    pause: !user,
  });

  if (ready && !user) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.signInPrompt}>
            <Link href="/signin">Sign in</Link> to see who you&apos;re
            following.
          </p>
        </div>
      </div>
    );
  }

  const entries: FollowEntry[] = result.data?.myFollowing ?? [];

  const userEntries = entries.filter((e) => e.targetType === 'user' && e.user);
  const airportEntries = entries.filter(
    (e) => e.targetType === 'airport' && e.airport,
  );
  const topicEntries = entries.filter(
    (e) =>
      (e.targetType === 'aircraft_type' || e.targetType === 'manufacturer') &&
      e.targetValue,
  );

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'users', label: 'Users', count: userEntries.length },
    { key: 'airports', label: 'Airports', count: airportEntries.length },
    { key: 'topics', label: 'Topics', count: topicEntries.length },
  ];

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Following</h1>
          <p className={styles.subtitle}>
            People, airports, and topics you follow
          </p>
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
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Loading */}
        {result.fetching && <p className={styles.loading}>Loading…</p>}

        {/* Users Tab */}
        {!result.fetching && activeTab === 'users' && (
          <>
            {userEntries.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>👤</div>
                <p className={styles.emptyText}>
                  You&apos;re not following anyone yet
                </p>
                <p className={styles.emptySub}>
                  Follow photographers to see their photos in your feed
                </p>
              </div>
            ) : (
              <div className={styles.list}>
                {userEntries.map((entry) => {
                  const u = entry.user!;
                  const displayName =
                    u.profile?.displayName ?? u.username;
                  return (
                    <div key={entry.id} className={styles.listItem}>
                      <Link
                        href={`/u/${u.username}/photos`}
                        className={styles.itemLink}
                      >
                        <div className={styles.itemAvatar}>
                          {u.profile?.avatarUrl ? (
                            <img
                              src={u.profile.avatarUrl}
                              alt={displayName}
                            />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className={styles.itemDetails}>
                          <div className={styles.itemName}>{displayName}</div>
                          <div className={styles.itemMeta}>
                            @{u.username}
                          </div>
                        </div>
                      </Link>
                      <FollowButton
                        userId={u.id}
                        initialIsFollowing={u.isFollowedByMe}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Airports Tab */}
        {!result.fetching && activeTab === 'airports' && (
          <>
            {airportEntries.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🛫</div>
                <p className={styles.emptyText}>
                  You&apos;re not following any airports
                </p>
                <p className={styles.emptySub}>
                  Follow airports to see photos taken there in your feed
                </p>
              </div>
            ) : (
              <div className={styles.list}>
                {airportEntries.map((entry) => {
                  const a = entry.airport!;
                  const code = a.iataCode ?? a.icaoCode;
                  const location = [a.city, a.country]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div key={entry.id} className={styles.listItem}>
                      <Link
                        href={`/airports/${a.icaoCode}`}
                        className={styles.itemLink}
                      >
                        <div className={styles.itemIcon}>🛫</div>
                        <div className={styles.itemDetails}>
                          <div className={styles.itemName}>
                            {a.name} ({code})
                          </div>
                          <div className={styles.itemMeta}>
                            {location}
                            {a.followerCount > 0 &&
                              ` · ${a.followerCount} follower${a.followerCount === 1 ? '' : 's'}`}
                          </div>
                        </div>
                      </Link>
                      <AirportFollowButton
                        airportId={a.id}
                        initialIsFollowing={a.isFollowedByMe}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Topics Tab */}
        {!result.fetching && activeTab === 'topics' && (
          <>
            {topicEntries.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>✈️</div>
                <p className={styles.emptyText}>
                  You&apos;re not following any topics
                </p>
                <p className={styles.emptySub}>
                  Follow aircraft types from photo detail pages to see them in
                  your feed
                </p>
              </div>
            ) : (
              <div className={styles.list}>
                {topicEntries.map((entry) => {
                  const typeLabel =
                    entry.targetType === 'aircraft_type'
                      ? 'Aircraft Type'
                      : 'Manufacturer';
                  const icon =
                    entry.targetType === 'aircraft_type' ? '✈️' : '🏭';
                  return (
                    <div key={entry.id} className={styles.listItem}>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemIcon}>{icon}</div>
                        <div className={styles.itemDetails}>
                          <div className={styles.itemName}>
                            {entry.targetValue}
                          </div>
                          <div className={styles.itemMeta}>
                            <span className={styles.itemType}>
                              {typeLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <TopicFollowButton
                        targetType={
                          entry.targetType as 'aircraft_type' | 'manufacturer'
                        }
                        value={entry.targetValue!}
                        initialIsFollowing={true}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
