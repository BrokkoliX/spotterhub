'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { FOLLOW_AIRPORT, UNFOLLOW_AIRPORT } from '@/lib/queries';

import styles from './FollowButton.module.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface AirportFollowButtonProps {
  airportId: string;
  initialIsFollowing: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Follow/Unfollow button for airports.
 * Uses the same styling as the user FollowButton.
 */
export function AirportFollowButton({ airportId, initialIsFollowing }: AirportFollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isHovering, setIsHovering] = useState(false);

  const [, executeFollow] = useMutation(FOLLOW_AIRPORT);
  const [, executeUnfollow] = useMutation(UNFOLLOW_AIRPORT);

  const handleClick = useCallback(async () => {
    if (!user) {
      router.push('/signin');
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    const result = wasFollowing
      ? await executeUnfollow({ airportId })
      : await executeFollow({ airportId });

    if (result.error) {
      setIsFollowing(wasFollowing);
    }
  }, [user, isFollowing, airportId, router, executeFollow, executeUnfollow]);

  const label = isFollowing
    ? isHovering
      ? 'Unfollow'
      : 'Following'
    : 'Follow';

  return (
    <button
      type="button"
      className={`${styles.button} ${isFollowing ? styles.following : styles.follow}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={isFollowing ? 'Unfollow airport' : 'Follow airport'}
    >
      {label}
    </button>
  );
}
