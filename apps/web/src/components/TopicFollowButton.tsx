'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { FOLLOW_TOPIC, UNFOLLOW_TOPIC } from '@/lib/queries';

import styles from './FollowButton.module.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TopicFollowButtonProps {
  targetType: 'aircraft_type' | 'manufacturer';
  value: string;
  initialIsFollowing: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Follow/Unfollow button for topics (aircraft types or manufacturers).
 * Uses the same styling as the user FollowButton.
 */
export function TopicFollowButton({
  targetType,
  value,
  initialIsFollowing,
}: TopicFollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isHovering, setIsHovering] = useState(false);

  const [, executeFollow] = useMutation(FOLLOW_TOPIC);
  const [, executeUnfollow] = useMutation(UNFOLLOW_TOPIC);

  const handleClick = useCallback(async () => {
    if (!user) {
      router.push('/signin');
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    const result = wasFollowing
      ? await executeUnfollow({ targetType, value })
      : await executeFollow({ targetType, value });

    if (result.error) {
      setIsFollowing(wasFollowing);
    }
  }, [user, isFollowing, targetType, value, router, executeFollow, executeUnfollow]);

  const label = isFollowing
    ? isHovering
      ? 'Unfollow'
      : 'Following'
    : 'Follow';

  const ariaTarget =
    targetType === 'aircraft_type' ? 'aircraft type' : 'manufacturer';

  return (
    <button
      type="button"
      className={`${styles.button} ${isFollowing ? styles.following : styles.follow}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={isFollowing ? `Unfollow ${ariaTarget}` : `Follow ${ariaTarget}`}
    >
      {label}
    </button>
  );
}
