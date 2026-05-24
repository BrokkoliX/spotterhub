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
  // Session-token lifetimes — defaults match the API's SiteSettings defaults.
  const [accessTokenSeconds, setAccessTokenSeconds] = useState('3600');
  const [refreshTokenSeconds, setRefreshTokenSeconds] = useState('604800');
  // World-map refresh debounce (ms). Default mirrors the API's SiteSettings
  // default and the previously-hardcoded 300 ms used on /map.
  const [mapRefreshDebounceMs, setMapRefreshDebounceMs] = useState('300');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Populate form from server data
  useEffect(() => {
    if (data?.siteSettings) {
      setMinEdge(String(data.siteSettings.minPhotoLongEdge));
      setMaxEdge(String(data.siteSettings.maxPhotoLongEdge));
      setTimeoutSeconds(String(data.siteSettings.photoUploadTimeoutSeconds));
      setAccessTokenSeconds(String(data.siteSettings.accessTokenSeconds));
      setRefreshTokenSeconds(String(data.siteSettings.refreshTokenSeconds));
      setMapRefreshDebounceMs(String(data.siteSettings.mapRefreshDebounceMs));
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
    const access = parseInt(accessTokenSeconds, 10);
    const refresh = parseInt(refreshTokenSeconds, 10);
    const mapDebounce = parseInt(mapRefreshDebounceMs, 10);

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
    // Mirror the API's validation so the user sees the error inline rather
    // than after a server round-trip.
    if (isNaN(access) || access < 60 || access > 86400) {
      setMessage({
        type: 'error',
        text: 'Access token lifetime must be between 60 (1 minute) and 86,400 (24 hours) seconds.',
      });
      return;
    }
    if (isNaN(refresh) || refresh < 3600 || refresh > 2592000) {
      setMessage({
        type: 'error',
        text: 'Refresh token lifetime must be between 3,600 (1 hour) and 2,592,000 (30 days) seconds.',
      });
      return;
    }
    if (access >= refresh) {
      setMessage({
        type: 'error',
        text: 'Access token lifetime must be shorter than the refresh token lifetime.',
      });
      return;
    }
    if (isNaN(mapDebounce) || mapDebounce < 0 || mapDebounce > 10000) {
      setMessage({
        type: 'error',
        text: 'Map refresh debounce must be between 0 and 10,000 ms.',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await updateSettings({
        input: {
          minPhotoLongEdge: min,
          maxPhotoLongEdge: max,
          photoUploadTimeoutSeconds: timeout,
          accessTokenSeconds: access,
          refreshTokenSeconds: refresh,
          mapRefreshDebounceMs: mapDebounce,
        },
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
            Configure the minimum and maximum allowed photo resolution (long edge in pixels). Photos
            outside this range will be rejected during upload.
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
            Maximum time allowed for a photo upload before it is cancelled. Must be between 30 and
            3600 seconds.
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
            <span className={styles.hint}>Default: 300 seconds (5 minutes).</span>
          </div>

          <h2 className={styles.sectionTitle}>🔐 Session Timeouts</h2>
          <p className={styles.sectionDesc}>
            Control how long a signed-in user&apos;s browser session remains valid. The access token
            is the short-lived JWT used on every API call; once it expires the browser silently
            exchanges the refresh token for a new one. The refresh token defines the absolute upper
            bound on a session — once it expires the user must sign in again. Changes apply to new
            sign-ins and refreshes within ~1 minute; existing sessions keep their current lifetime.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="accessTokenSeconds">
              Access token lifetime (seconds)
            </label>
            <input
              id="accessTokenSeconds"
              type="number"
              className={styles.input}
              value={accessTokenSeconds}
              onChange={(e) => setAccessTokenSeconds(e.target.value)}
              min={60}
              max={86400}
            />
            <span className={styles.hint}>
              60 seconds (1 minute) to 86,400 seconds (24 hours). Default: 3,600 (1 hour). Shorter
              values reduce the blast radius of a stolen token but cause more silent refreshes.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="refreshTokenSeconds">
              Refresh token lifetime (seconds)
            </label>
            <input
              id="refreshTokenSeconds"
              type="number"
              className={styles.input}
              value={refreshTokenSeconds}
              onChange={(e) => setRefreshTokenSeconds(e.target.value)}
              min={3600}
              max={2592000}
            />
            <span className={styles.hint}>
              3,600 seconds (1 hour) to 2,592,000 seconds (30 days). Default: 604,800 (7 days). This
              is how long users stay logged in across browser restarts.
            </span>
          </div>

          <h2 className={styles.sectionTitle}>🗺 World Map</h2>
          <p className={styles.sectionDesc}>
            Controls how aggressively the world map refetches airports and photos as the user pans
            and zooms. The debounce is the wait between the last map movement and the next data
            refresh — raise it while calibrating to make the map feel calmer, lower it for a
            snappier feel at the cost of more API traffic.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="mapRefreshDebounceMs">
              Map refresh debounce (ms)
            </label>
            <input
              id="mapRefreshDebounceMs"
              type="number"
              className={styles.input}
              value={mapRefreshDebounceMs}
              onChange={(e) => setMapRefreshDebounceMs(e.target.value)}
              min={0}
              max={10000}
            />
            <span className={styles.hint}>
              0 to 10,000 milliseconds. Default: 300 ms. Set to 0 to refresh on every map movement.
            </span>
          </div>

          {message && (
            <div className={message.type === 'success' ? styles.msgSuccess : styles.msgError}>
              {message.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      )}
    </div>
  );
}
