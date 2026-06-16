'use client';

import { useMemo } from 'react';

import { AirportFollowButton } from './AirportFollowButton';
import { FollowButton } from './FollowButton';
import { TopicFollowButton } from './TopicFollowButton';
import type { FollowEntry } from '@/lib/followReasons';

import styles from './ManageFollowsSection.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManageFollowsSectionProps {
  /** The full myFollowing list. Grouped and rendered below. */
  myFollowing: readonly FollowEntry[];
  /**
   * Called after a successful unfollow (or follow) from any row.
   * The home page uses this to refetch `myFollowing` (so the row
   * disappears) and `followingFeed` (so the grid refreshes to reflect
   * the new set of matched photos).
   */
  onAfterUnfollow?: () => void;
}

// ─── Grouping ───────────────────────────────────────────────────────────────

interface Group {
  /** Header key — also used as the React key for the group block. */
  key: 'user' | 'airport' | 'manufacturer' | 'family' | 'variant' | 'airline' | 'registration';
  title: string;
  icon: string;
  entries: FollowEntry[];
}

// Render order — high-priority groups first.
const GROUP_ORDER: Group['key'][] = [
  'user',
  'airport',
  'manufacturer',
  'family',
  'variant',
  'airline',
  'registration',
];

const GROUP_META: Record<Group['key'], { title: string; icon: string }> = {
  user: { title: 'Photographers', icon: '👤' },
  airport: { title: 'Airports', icon: '📍' },
  manufacturer: { title: 'Manufacturers', icon: '🏭' },
  family: { title: 'Aircraft Families', icon: '✈️' },
  variant: { title: 'Variants', icon: '🔧' },
  airline: { title: 'Airlines', icon: '🛫' },
  registration: { title: 'Registrations', icon: '🔤' },
};

function groupFollows(myFollowing: readonly FollowEntry[]): Group[] {
  const buckets: Record<Group['key'], FollowEntry[]> = {
    user: [],
    airport: [],
    manufacturer: [],
    family: [],
    variant: [],
    airline: [],
    registration: [],
  };

  for (const f of myFollowing) {
    // Map the API targetType to our group key. `aircraft_type` is the only
    // value the API allows that we don't display (the home Following feed
    // doesn't consume it). Defensive: any unknown type is dropped.
    if (f.targetType === 'user') buckets.user.push(f);
    else if (f.targetType === 'airport') buckets.airport.push(f);
    else if (f.targetType === 'manufacturer') buckets.manufacturer.push(f);
    else if (f.targetType === 'family') buckets.family.push(f);
    else if (f.targetType === 'variant') buckets.variant.push(f);
    else if (f.targetType === 'airline') buckets.airline.push(f);
    else if (f.targetType === 'registration') buckets.registration.push(f);
  }

  return GROUP_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    key: k,
    title: GROUP_META[k].title,
    icon: GROUP_META[k].icon,
    entries: buckets[k],
  }));
}

// ─── Row label helpers ─────────────────────────────────────────────────────

function rowLabel(entry: FollowEntry): string {
  switch (entry.targetType) {
    case 'user':
      return `@${entry.user?.username ?? 'unknown'}`;
    case 'airport': {
      const a = entry.airport;
      if (!a) return entry.targetValue ?? 'unknown';
      const icao = a.icaoCode;
      const name = a.name ? ` — ${a.name}` : '';
      return `${icao}${name}`;
    }
    default:
      return entry.targetValue ?? 'unknown';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Collapsible section rendered beneath the Following feed. Groups every
 * followed entity by type and offers an inline unfollow button per row.
 *
 * Visibility: the parent decides whether to mount this component at all
 * (e.g. only on the Following tab, only when signed in, only when the
 * myFollowing list is non-empty). The component itself just renders what
 * it's given.
 */
export function ManageFollowsSection({ myFollowing, onAfterUnfollow }: ManageFollowsSectionProps) {
  const groups = useMemo(() => groupFollows(myFollowing), [myFollowing]);
  const total = myFollowing.length;

  if (total === 0) return null;

  return (
    <details className={styles.section}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>Manage follows</span>
        <span className={styles.summaryCount}>({total})</span>
        <span className={styles.summaryHint}>Click to expand</span>
      </summary>
      <div className={styles.body}>
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            <h3 className={styles.groupTitle}>
              <span className={styles.groupIcon}>{group.icon}</span>
              {group.title} <span className={styles.groupCount}>({group.entries.length})</span>
            </h3>
            <ul className={styles.list}>
              {group.entries.map((entry) => (
                <li key={entry.id} className={styles.row}>
                  <span className={styles.rowLabel}>{rowLabel(entry)}</span>
                  {group.key === 'user' && entry.user && (
                    <FollowButton
                      userId={entry.user.id}
                      initialIsFollowing={true}
                      onChange={onAfterUnfollow}
                    />
                  )}
                  {group.key === 'airport' && entry.airport && (
                    <AirportFollowButton
                      airportId={entry.airport.id}
                      initialIsFollowing={true}
                      onChange={onAfterUnfollow}
                    />
                  )}
                  {group.key !== 'user' && group.key !== 'airport' && entry.targetValue && (
                    <TopicFollowButton
                      targetType={group.key}
                      value={entry.targetValue}
                      initialIsFollowing={true}
                      onChange={onAfterUnfollow}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
