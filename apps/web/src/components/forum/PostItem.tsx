'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

import { ReportButton } from '@/components/ReportButton';

import styles from './forum.module.css';

export interface PostAuthor {
  username: string;
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface PostData {
  id: string;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string | null;
  author: PostAuthor;
}

export interface PostItemProps {
  post: PostData;
  /** Currently authenticated viewer (or null for anonymous). */
  viewer: { id: string; username: string; role: string } | null;
  /** Whether the viewer has moderator permissions in the current scope. */
  isModerator: boolean;
  /** Whether the viewer is allowed to reply (e.g. is community member, thread not locked). */
  canReply: boolean;
  /** Marks the first post in a thread (renders an OP badge and accent border). */
  isOp?: boolean;
  /** Marks this post as a nested reply (renders with a slightly different background). */
  isReply?: boolean;
  onReply?: (post: PostData) => void;
  onEdit?: (post: PostData) => void;
  onDelete?: (post: PostData) => void;
}

function authorLabel(author: PostAuthor): string {
  return author.profile?.displayName?.trim() || author.username;
}

function authorInitial(author: PostAuthor): string {
  return authorLabel(author).charAt(0).toUpperCase();
}

function avatarStyle(author: PostAuthor): CSSProperties | undefined {
  if (author.profile?.avatarUrl) {
    return { backgroundImage: `url(${author.profile.avatarUrl})` };
  }
  return undefined;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Single post in a forum thread. Handles top-level posts, replies, the OP
 * (first post) accent treatment, and the moderator/author action bar (reply,
 * edit, delete, report). Composition of inline edit forms is handled by the
 * parent via the `onEdit` callback.
 */
export function PostItem({
  post,
  viewer,
  isModerator,
  canReply,
  isOp = false,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
}: PostItemProps) {
  const isAuthor = viewer && post.author.username === viewer.username;
  const canEdit = !!isAuthor && !post.isDeleted && !!onEdit;
  const canDelete = (!!isAuthor || isModerator) && !!onDelete;
  const canShowReply = canReply && !post.isDeleted && !!onReply;
  const showAvatarUrl = !!post.author.profile?.avatarUrl;

  const className = [styles.post, isOp ? styles.postOp : '', isReply ? styles.postReply : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className}>
      <header className={styles.postHeader}>
        <div className={styles.postAvatar} style={avatarStyle(post.author)} aria-hidden="true">
          {!showAvatarUrl && authorInitial(post.author)}
        </div>
        <div className={styles.postAuthorBlock}>
          <div className={styles.postAuthorName}>
            <Link href={`/u/${post.author.username}/photos`}>{authorLabel(post.author)}</Link>
            {isOp && (
              <span className={styles.postOpBadge} style={{ marginLeft: 8 }}>
                OP
              </span>
            )}
          </div>
          <div className={styles.postDate}>
            {formatDateTime(post.createdAt)}
            {post.updatedAt && post.updatedAt !== post.createdAt && ' · edited'}
          </div>
        </div>
        <div className={styles.postHeaderRight}>
          {viewer && !post.isDeleted && <ReportButton targetType="forum_post" targetId={post.id} />}
        </div>
      </header>

      {post.isDeleted ? (
        <div className={styles.postDeleted}>[This post has been deleted]</div>
      ) : (
        <div className={styles.postBody}>{post.body}</div>
      )}

      {!post.isDeleted && (canShowReply || canEdit || canDelete) && (
        <div className={styles.postActions}>
          {canShowReply && (
            <button type="button" className={styles.postAction} onClick={() => onReply?.(post)}>
              Reply
            </button>
          )}
          {canEdit && (
            <button type="button" className={styles.postAction} onClick={() => onEdit?.(post)}>
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className={`${styles.postAction} ${styles.postActionDanger}`}
              onClick={() => onDelete?.(post)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
