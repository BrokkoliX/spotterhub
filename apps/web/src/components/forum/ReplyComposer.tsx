'use client';

import Link from 'next/link';
import { useState } from 'react';

import styles from './forum.module.css';

export interface ReplyComposerProps {
  /** Submit handler returning an optional error message. */
  onSubmit: (body: string) => Promise<{ error?: string | null } | void>;
  /** Optional indication that the user is replying to a specific post. */
  replyingTo?: { authorName: string } | null;
  onCancelReply?: () => void;
  isLocked?: boolean;
  /** When true, renders a sign-in prompt instead of the composer. */
  isAnonymous?: boolean;
}

/**
 * Reply composer used at the bottom of a thread. Handles the common cases:
 * locked threads, anonymous viewers (sign-in prompt), and replying to a
 * specific post. The submit callback decouples this component from the
 * underlying GraphQL mutation.
 */
export function ReplyComposer({
  onSubmit,
  replyingTo,
  onCancelReply,
  isLocked = false,
  isAnonymous = false,
}: ReplyComposerProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(body.trim());
      if (result && result.error) {
        setError(result.error);
      } else {
        setBody('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div className={styles.composer} id="composer">
        <div className={styles.composerLocked}>
          This thread is locked and no longer accepts replies.
        </div>
      </div>
    );
  }

  if (isAnonymous) {
    return (
      <div className={styles.composer} id="composer">
        <div className={styles.composerLocked}>
          <Link href="/signin">Sign in</Link> to join the discussion.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.composer} id="composer">
      <div className={styles.composerTitle}>
        {replyingTo ? `Replying to ${replyingTo.authorName}` : 'Add a Reply'}
      </div>
      {replyingTo && onCancelReply && (
        <div className={styles.composerReplyingTo}>
          <span>
            Replying to <strong>{replyingTo.authorName}</strong>
          </span>
          <button type="button" className={styles.composerCancel} onClick={onCancelReply}>
            Cancel
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          className={styles.composerTextarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply…"
          required
          aria-label="Reply body"
        />
        {error && <div className={styles.composerError}>{error}</div>}
        <div className={styles.composerActions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Reply'}
          </button>
        </div>
      </form>
    </div>
  );
}
