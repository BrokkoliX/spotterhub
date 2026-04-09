'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { FOLLOW_USER, UNFOLLOW_USER } from '@/lib/queries';

import styles from './FollowButton.module.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Follow/Unfollow button with optimistic UI updates.
 * Hidden when viewing your own profile.
 * Redirects to sign-in if not authenticated.
 */
export function FollowButton({ userId, initialIsFollowing }: FollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isHovering, setIsHovering] = useState(false);

  const [, executeFollow] = useMutation(FOLLOW_USER);
  const [, executeUnfollow] = useMutation(UNFOLLOW_USER);

  const handleClick = useCallback(async () => {
    if (!user) {
      router.push('/signin');
      return;
    }

    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    const result = wasFollowing
      ? await executeUnfollow({ userId })
      : await executeFollow({ userId });

    // Revert on error
    if (result.error) {
      setIsFollowing(wasFollowing);
    }
  }, [user, isFollowing, userId, router, executeFollow, executeUnfollow]);

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
      aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
    >
      {label}
    </button>
  );
}
