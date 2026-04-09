'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADD_COMMENT, DELETE_COMMENT, GET_COMMENTS } from '@/lib/queries';

import styles from './CommentSection.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CommentUser {
  id: string;
  username: string;
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
}

interface CommentData {
  id: string;
  body: string;
  createdAt: string;
  user: CommentUser;
  replies: CommentData[];
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface CommentSectionProps {
  photoId: string;
}

// ─── Single Comment ─────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: CommentData;
  currentUserId: string | null;
  onDelete: (id: string) => void;
}) {
  const displayName = comment.user.profile?.displayName ?? comment.user.username;
  const timeAgo = formatTimeAgo(comment.createdAt);

  return (
    <div className={styles.comment}>
      <div className={styles.avatar}>
        {comment.user.profile?.avatarUrl ? (
          <img src={comment.user.profile.avatarUrl} alt={displayName} />
        ) : (
          '👤'
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <Link href={`/u/${comment.user.username}/photos`} className={styles.author}>
            {displayName}
          </Link>
          <span className={styles.time}>{timeAgo}</span>
        </div>
        <p className={styles.body}>{comment.body}</p>
        {currentUserId === comment.user.id && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CommentSection({ photoId }: CommentSectionProps) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [commentsResult, reexecuteQuery] = useQuery({
    query: GET_COMMENTS,
    variables: { photoId, first: 20 },
  });

  const [, executeAddComment] = useMutation(ADD_COMMENT);
  const [, executeDeleteComment] = useMutation(DELETE_COMMENT);

  const comments: CommentData[] =
    commentsResult.data?.comments?.edges?.map(
      (e: { node: CommentData }) => e.node,
    ) ?? [];
  const totalCount = commentsResult.data?.comments?.totalCount ?? 0;
  const hasNextPage = commentsResult.data?.comments?.pageInfo?.hasNextPage ?? false;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = body.trim();
      if (!trimmed || submitting) return;

      setSubmitting(true);
      const result = await executeAddComment({
        input: { photoId, body: trimmed },
      });
      setSubmitting(false);

      if (!result.error) {
        setBody('');
        reexecuteQuery({ requestPolicy: 'network-only' });
      }
    },
    [body, submitting, photoId, executeAddComment, reexecuteQuery],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      await executeDeleteComment({ id: commentId });
      reexecuteQuery({ requestPolicy: 'network-only' });
    },
    [executeDeleteComment, reexecuteQuery],
  );

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>
        Comments{totalCount > 0 ? ` (${totalCount})` : ''}
      </h3>

      {user ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.input}
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!body.trim() || submitting}
          >
            {submitting ? '…' : 'Post'}
          </button>
        </form>
      ) : (
        <p className={styles.signInPrompt}>
          <Link href="/signin">Sign in</Link> to leave a comment.
        </p>
      )}

      {commentsResult.fetching && comments.length === 0 ? (
        <p className={styles.empty}>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className={styles.empty}>No comments yet. Be the first!</p>
      ) : (
        <div className={styles.list}>
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={user?.id ?? null}
                onDelete={handleDelete}
              />
              {comment.replies.length > 0 && (
                <div className={styles.replies}>
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={user?.id ?? null}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className={styles.loadMore}>
          <button type="button" className={styles.loadMoreBtn}>
            Load more comments
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
