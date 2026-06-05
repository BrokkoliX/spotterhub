'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

import styles from './forum.module.css';

export interface ThreadAuthor {
  username: string;
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface ThreadCardData {
  id: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  createdAt: string;
  lastPostAt: string;
  author: ThreadAuthor;
  firstPost?: { body: string } | null;
}

export interface ThreadCardProps {
  thread: ThreadCardData;
  href: string;
}

function authorLabel(author: ThreadAuthor): string {
  return author.profile?.displayName?.trim() || author.username;
}

function authorInitial(author: ThreadAuthor): string {
  const label = authorLabel(author);
  return label.charAt(0).toUpperCase();
}

function avatarStyle(author: ThreadAuthor): CSSProperties | undefined {
  if (author.profile?.avatarUrl) {
    return { backgroundImage: `url(${author.profile.avatarUrl})` };
  }
  return undefined;
}

function snippet(body: string | undefined | null, max = 160): string {
  if (!body) return '';
  const trimmed = body.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Card representation of a forum thread for use in a thread list.
 *
 * Three visual zones (desktop): author avatar, content (title + snippet +
 * byline), and activity (reply count + last activity timestamp). Below
 * `--bp-md` (768px) the avatar collapses into the byline and the activity
 * row drops below the content.
 */
export function ThreadCard({ thread, href }: ThreadCardProps) {
  const showAvatarUrl = !!thread.author.profile?.avatarUrl;
  const cardClass = thread.isPinned
    ? `${styles.threadCard} ${styles.threadCardPinned}`
    : styles.threadCard;

  return (
    <Link href={href} className={cardClass} aria-label={`Thread: ${thread.title}`}>
      <div className={styles.threadAuthor}>
        <div
          className={styles.threadAuthorAvatar}
          style={avatarStyle(thread.author)}
          aria-hidden="true"
        >
          {!showAvatarUrl && authorInitial(thread.author)}
        </div>
      </div>

      <div className={styles.threadContent}>
        <div className={styles.threadTitleRow}>
          {thread.isPinned && (
            <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>
          )}
          {thread.isLocked && (
            <span className={`${styles.badge} ${styles.badgeLocked}`}>Locked</span>
          )}
          <h3 className={styles.threadTitle}>{thread.title}</h3>
        </div>

        {thread.firstPost?.body && (
          <p className={styles.threadSnippet}>{snippet(thread.firstPost.body)}</p>
        )}

        <div className={styles.threadByline}>
          <span
            className={styles.threadBylineMobileAvatar}
            style={avatarStyle(thread.author)}
            aria-hidden="true"
          >
            {!showAvatarUrl && authorInitial(thread.author)}
          </span>
          <span>by {authorLabel(thread.author)}</span>
          <span data-sep="true">·</span>
          <time dateTime={thread.createdAt}>{formatRelative(thread.createdAt)}</time>
        </div>
      </div>

      <div className={styles.threadActivity}>
        <div className={styles.threadActivityCount}>
          <span className={styles.threadActivityCountValue}>{thread.postCount}</span>
          <span className={styles.threadActivityCountLabel}>
            {thread.postCount === 1 ? 'post' : 'posts'}
          </span>
        </div>
        <time className={styles.threadActivityLastSeen} dateTime={thread.lastPostAt}>
          {formatRelative(thread.lastPostAt)}
        </time>
      </div>
    </Link>
  );
}
