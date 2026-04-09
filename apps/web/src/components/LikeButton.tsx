'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { LIKE_PHOTO, UNLIKE_PHOTO } from '@/lib/queries';

import styles from './LikeButton.module.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface LikeButtonProps {
  photoId: string;
  initialLikeCount: number;
  initialIsLiked: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Interactive like/unlike button with optimistic UI updates.
 * Redirects to sign-in if the user is not authenticated.
 */
export function LikeButton({
  photoId,
  initialLikeCount,
  initialIsLiked,
}: LikeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  const [, executeLike] = useMutation(LIKE_PHOTO);
  const [, executeUnlike] = useMutation(UNLIKE_PHOTO);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user) {
        router.push('/signin');
        return;
      }

      // Optimistic update
      const wasLiked = isLiked;
      const prevCount = likeCount;
      setIsLiked(!wasLiked);
      setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);

      const result = wasLiked
        ? await executeUnlike({ photoId })
        : await executeLike({ photoId });

      // Revert on error
      if (result.error) {
        setIsLiked(wasLiked);
        setLikeCount(prevCount);
      }
    },
    [user, isLiked, likeCount, photoId, router, executeLike, executeUnlike],
  );

  return (
    <button
      type="button"
      className={`${styles.button}${isLiked ? ` ${styles.liked}` : ''}`}
      onClick={handleClick}
      aria-label={isLiked ? 'Unlike photo' : 'Like photo'}
    >
      <span className={styles.heart}>{isLiked ? '♥' : '♡'}</span>
      <span className={styles.count}>{likeCount}</span>
    </button>
  );
}
