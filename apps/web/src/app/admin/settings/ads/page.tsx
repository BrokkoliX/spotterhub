'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_AD_SETTINGS, UPDATE_AD_SETTINGS } from '@/lib/queries';

import styles from '../page.module.css';

export default function AdminAdSettingsPage() {
  const { user, ready } = useAuth();
  const isSuperuser = user?.role === 'superuser';

  const [{ data, fetching }] = useQuery({
    query: GET_AD_SETTINGS,
    pause: !isSuperuser,
  });

  const [, updateSettings] = useMutation(UPDATE_AD_SETTINGS);

  // ─── Form state ─────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(true);
  const [adSenseClientId, setAdSenseClientId] = useState('');
  const [slotFeed, setSlotFeed] = useState('');
  const [slotPhotoDetail, setSlotPhotoDetail] = useState('');
  const [slotSidebar, setSlotSidebar] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Populate form from server data
  useEffect(() => {
    if (data?.adSettings) {
      setEnabled(data.adSettings.enabled);
      setAdSenseClientId(data.adSettings.adSenseClientId);
      setSlotFeed(data.adSettings.slotFeed ?? '');
      setSlotPhotoDetail(data.adSettings.slotPhotoDetail ?? '');
      setSlotSidebar(data.adSettings.slotSidebar ?? '');
    }
  }, [data]);

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isSuperuser) return <div className={styles.denied}>Access denied — superuser only</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!adSenseClientId.trim()) {
      setMessage({ type: 'error', text: 'AdSense Client ID is required.' });
      return;
    }

    setSaving(true);
    try {
      const result = await updateSettings({
        input: {
          enabled,
          adSenseClientId: adSenseClientId.trim(),
          slotFeed: slotFeed.trim() || null,
          slotPhotoDetail: slotPhotoDetail.trim() || null,
          slotSidebar: slotSidebar.trim() || null,
        },
      });
      if (result.error) {
        setMessage({ type: 'error', text: result.error.message });
      } else {
        setMessage({ type: 'success', text: 'Ad settings saved.' });
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
      <h1 className={styles.title}>Ad Settings</h1>

      {fetching ? (
        <div className={styles.loading}>Loading settings…</div>
      ) : (
        <form onSubmit={handleSave} className={styles.section}>
          <h2 className={styles.sectionTitle}>📺 Google AdSense</h2>
          <p className={styles.sectionDesc}>
            Configure Google AdSense to display ads on the platform. Get your ad slot IDs from your AdSense dashboard.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Enable ads
            </label>
            <span className={styles.hint}>
              When disabled, no ads are shown anywhere on the site.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="clientId">
              AdSense Client ID
            </label>
            <input
              id="clientId"
              type="text"
              className={styles.input}
              value={adSenseClientId}
              onChange={(e) => setAdSenseClientId(e.target.value)}
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              style={{ maxWidth: 280 }}
            />
            <span className={styles.hint}>
              Found in your AdSense account → Ads → Site ads. Format: ca-pub-XXXXXXXXXXXXXXXX
            </span>
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>Ad Slot IDs</h2>
          <p className={styles.sectionDesc}>
            Create ad units in your AdSense dashboard for each placement below. Each slot ID is unique to a specific position on your site.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="slotFeed">
              Feed / Homepage Slot ID
            </label>
            <input
              id="slotFeed"
              type="text"
              className={styles.input}
              value={slotFeed}
              onChange={(e) => setSlotFeed(e.target.value)}
              placeholder="e.g. 9876543210"
            />
            <span className={styles.hint}>
              In-feed ad shown below the hero and every 12 photos in the feed grid.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="slotPhotoDetail">
              Photo Detail Slot ID
            </label>
            <input
              id="slotPhotoDetail"
              type="text"
              className={styles.input}
              value={slotPhotoDetail}
              onChange={(e) => setSlotPhotoDetail(e.target.value)}
              placeholder="e.g. 1234567890"
            />
            <span className={styles.hint}>
              Shown after the photo image and below the comments section on photo detail pages.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="slotSidebar">
              Sidebar Slot ID (optional)
            </label>
            <input
              id="slotSidebar"
              type="text"
              className={styles.input}
              value={slotSidebar}
              onChange={(e) => setSlotSidebar(e.target.value)}
              placeholder="e.g. 5555555555"
            />
            <span className={styles.hint}>
              Reserved for future sidebar ad placements.
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
