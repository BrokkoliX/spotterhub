'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_REPORT } from '@/lib/queries';

import styles from './ReportButton.module.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReportButtonProps {
  targetType: 'photo' | 'comment' | 'profile' | 'album' | 'community' | 'forum_post' | 'marketplace_item';
  targetId: string;
}

// ─── Reason options ─────────────────────────────────────────────────────────

const REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Report button that opens a modal with reason selection.
 * Only visible to authenticated users.
 */
export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, executeReport] = useMutation(CREATE_REPORT);

  const handleOpen = useCallback(() => {
    if (!user) {
      router.push('/signin');
      return;
    }
    setIsOpen(true);
    setReason('');
    setDescription('');
    setSubmitted(false);
    setError(null);
  }, [user, router]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;

    setError(null);
    const result = await executeReport({
      input: {
        targetType,
        targetId,
        reason,
        description: description.trim() || undefined,
      },
    });

    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to submit report');
    } else {
      setSubmitted(true);
    }
  }, [reason, description, targetType, targetId, executeReport]);

  const canSubmit = reason && (reason !== 'other' || description.trim().length > 0);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={handleOpen}
        aria-label="Report content"
      >
        ⚑ Report
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <>
                <h3 className={styles.modalTitle}>Report Submitted</h3>
                <p className={styles.success}>
                  Thank you for helping keep SpotterSpace safe. Our team will review this report.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Report Content</h3>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.reasons}>
                  {REASONS.map((r) => (
                    <label key={r.value} className={styles.reasonLabel}>
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                {reason === 'other' && (
                  <textarea
                    className={styles.description}
                    placeholder="Please describe the issue…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                )}

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
