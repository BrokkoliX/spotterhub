'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_SITE_SETTINGS, UPDATE_SITE_SETTINGS } from '@/lib/queries';

import styles from './page.module.css';

export default function AdminSettingsPage() {
  const { user, ready } = useAuth();
  const isSuperuser = user?.role === 'superuser';

  const [{ data, fetching }] = useQuery({
    query: GET_SITE_SETTINGS,
    pause: !isSuperuser,
  });

  const [, updateSettings] = useMutation(UPDATE_SITE_SETTINGS);

  // ─── Form state ─────────────────────────────────────────────────────────
  const [minEdge, setMinEdge] = useState('800');
  const [maxEdge, setMaxEdge] = useState('4096');
  const [timeoutSeconds, setTimeoutSeconds] = useState('300');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Populate form from server data
  useEffect(() => {
    if (data?.siteSettings) {
      setMinEdge(String(data.siteSettings.minPhotoLongEdge));
      setMaxEdge(String(data.siteSettings.maxPhotoLongEdge));
      setTimeoutSeconds(String(data.siteSettings.photoUploadTimeoutSeconds));
    }
  }, [data]);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isSuperuser) return <div className={styles.denied}>Access denied — superuser only</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const min = parseInt(minEdge, 10);
    const max = parseInt(maxEdge, 10);
    const timeout = parseInt(timeoutSeconds, 10);

    if (isNaN(min) || isNaN(max)) {
      setMessage({ type: 'error', text: 'Please enter valid numbers.' });
      return;
    }
    if (min < 100 || min > 10000) {
      setMessage({ type: 'error', text: 'Minimum must be between 100 and 10,000 px.' });
      return;
    }
    if (max < 100 || max > 10000) {
      setMessage({ type: 'error', text: 'Maximum must be between 100 and 10,000 px.' });
      return;
    }
    if (min >= max) {
      setMessage({ type: 'error', text: 'Minimum must be less than maximum.' });
      return;
    }
    if (isNaN(timeout) || timeout < 30 || timeout > 3600) {
      setMessage({ type: 'error', text: 'Upload timeout must be between 30 and 3600 seconds.' });
      return;
    }

    setSaving(true);
    try {
      const result = await updateSettings({
        input: { minPhotoLongEdge: min, maxPhotoLongEdge: max, photoUploadTimeoutSeconds: timeout },
      });
      if (result.error) {
        setMessage({ type: 'error', text: result.error.message });
      } else {
        setMessage({ type: 'success', text: 'Settings saved.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <a href="/admin" className={styles.backLink}>
        ← Back to admin
      </a>
      <h1 className={styles.title}>General Settings</h1>

      {fetching ? (
        <div className={styles.loading}>Loading settings…</div>
      ) : (
        <form onSubmit={handleSave} className={styles.section}>
          <h2 className={styles.sectionTitle}>📷 Photo Dimensions</h2>
          <p className={styles.sectionDesc}>
            Configure the minimum and maximum allowed photo resolution (long edge in pixels).
            Photos outside this range will be rejected during upload.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="minEdge">
              Minimum long edge (px)
            </label>
            <input
              id="minEdge"
              type="number"
              className={styles.input}
              value={minEdge}
              onChange={(e) => setMinEdge(e.target.value)}
              min={100}
              max={10000}
            />
            <span className={styles.hint}>
              Photos smaller than this are rejected. Default: 800 px.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="maxEdge">
              Maximum long edge (px)
            </label>
            <input
              id="maxEdge"
              type="number"
              className={styles.input}
              value={maxEdge}
              onChange={(e) => setMaxEdge(e.target.value)}
              min={100}
              max={10000}
            />
            <span className={styles.hint}>
              Photos larger than this are rejected. Default: 4096 px.
            </span>
          </div>

          <h2 className={styles.sectionTitle}>⏱ Photo Upload Timeout</h2>
          <p className={styles.sectionDesc}>
            Maximum time allowed for a photo upload before it is cancelled. Must be between 30 and 3600 seconds.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="timeout">
              Upload timeout (seconds)
            </label>
            <input
              id="timeout"
              type="number"
              className={styles.input}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(e.target.value)}
              min={30}
              max={3600}
            />
            <span className={styles.hint}>
              Default: 300 seconds (5 minutes).
            </span>
          </div>

          {message && (
            <div
              className={
                message.type === 'success' ? styles.msgSuccess : styles.msgError
              }
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      )}
    </div>
  );
}
