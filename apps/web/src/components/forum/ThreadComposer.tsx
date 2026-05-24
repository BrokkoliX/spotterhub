'use client';

import { useState } from 'react';

import styles from './forum.module.css';

export interface ThreadComposerProps {
  /** Called when the user submits. Should return when the create call settles. */
  onSubmit: (input: { title: string; body: string }) => Promise<{ error?: string | null } | void>;
  onCancel?: () => void;
  /** When true, render inline (no modal wrapper). Defaults to inline. */
  variant?: 'inline' | 'modal';
  title?: string;
}

/**
 * Title + body composer used to start a new thread. Available in two
 * variants: a card-style inline form (default, used by community forum) and
 * a modal overlay (used by the global forum). The submit handler is provided
 * by the parent so this component remains agnostic of the GraphQL mutation.
 */
export function ThreadComposer({
  onSubmit,
  onCancel,
  variant = 'inline',
  title: heading = 'Start a New Thread',
}: ThreadComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit({ title: title.trim(), body: body.trim() });
      if (result && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <>
      <div className={styles.composerTitle}>{heading}</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          className={styles.composerInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread title"
          required
          minLength={3}
          maxLength={200}
          autoFocus
          aria-label="Thread title"
        />
        <textarea
          className={styles.composerTextarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your thoughts…"
          required
          minLength={1}
          aria-label="First post body"
        />
        {error && <div className={styles.composerError}>{error}</div>}
        <div className={styles.composerActions}>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Thread'}
          </button>
        </div>
      </form>
    </>
  );

  if (variant === 'modal') {
    return (
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget && onCancel) onCancel();
        }}
      >
        <div className={styles.modalCard}>{form}</div>
      </div>
    );
  }

  return <div className={styles.composer}>{form}</div>;
}
