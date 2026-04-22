'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'urql';

import { APPLY_TO_SELL } from '@/lib/queries';

import styles from './page.module.css';

export default function SellPage() {
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [{ fetching }, applyMutation] = useMutation(APPLY_TO_SELL);

  const handleApply = async () => {
    if (!bio.trim()) {
      setError('Please write a short bio');
      return;
    }
    setError(null);
    const result = await applyMutation({
      input: { bio: bio.trim(), website: website.trim() || undefined },
    });
    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to apply');
    } else {
      router.push('/sell/listings');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/settings/profile" className={styles.backLink}>
          ← Back to settings
        </Link>
        <h1 className={styles.title}>Become a Seller</h1>
        <p className={styles.subtitle}>
          Apply to start listing aviation memorabilia, models, gear, and more.
        </p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Seller Application</h2>
          <p className={styles.cardText}>
            Tell buyers about yourself so they can trust you. Your application will
            be reviewed by our team.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bio">
              Bio <span className={styles.required}>*</span>
            </label>
            <textarea
              id="bio"
              className={styles.textarea}
              placeholder="Describe your experience with aviation collectibles, what you typically sell, etc."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <span className={styles.charCount}>{bio.length}/500</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="website">
              Website <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="website"
              type="url"
              className={styles.input}
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className="btn btn-primary btn-lg"
            onClick={handleApply}
            disabled={fetching}
            type="button"
          >
            {fetching ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}