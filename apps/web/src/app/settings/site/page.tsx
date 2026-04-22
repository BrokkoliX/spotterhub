'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  GET_SITE_SETTINGS,
  GET_UPLOAD_URL,
  UPDATE_SITE_SETTINGS,
} from '@/lib/queries';

import styles from './page.module.css';

const S3_IMAGES_HOST = process.env.NEXT_PUBLIC_S3_IMAGES_HOST ?? 'http://localhost:4566';
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET ?? 'spotterspace-photos';

export default function SiteSettingsPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [bannerUrl, setBannerUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formInitialized, setFormInitialized] = useState(false);

  const [{ data, fetching }] = useQuery({
    query: GET_SITE_SETTINGS,
    pause: !ready || !user,
  });
  const [, updateSettings] = useMutation(UPDATE_SITE_SETTINGS);
  const [, getUploadUrl] = useMutation(GET_UPLOAD_URL);

  useEffect(() => {
    if (ready && !user) {
      router.push('/signin');
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (data?.siteSettings && !formInitialized) {
      setBannerUrl(data.siteSettings.bannerUrl ?? '');
      setTagline(data.siteSettings.tagline ?? '');
      setFormInitialized(true);
    }
  }, [data, formInitialized]);

  const handleBannerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBannerUploading(true);
      setError('');
      try {
        const urlResult = await getUploadUrl({
          input: { mimeType: file.type, fileSizeBytes: file.size },
        });
        if (urlResult.error || !urlResult.data?.getUploadUrl) {
          throw new Error(urlResult.error?.graphQLErrors?.[0]?.message || 'Failed to get upload URL');
        }
        const { url: presignedUrl, key } = urlResult.data.getUploadUrl;
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        setBannerUrl(`${S3_IMAGES_HOST}/${S3_BUCKET}/${key}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Banner upload failed');
      } finally {
        setBannerUploading(false);
        if (bannerInputRef.current) bannerInputRef.current.value = '';
      }
    },
    [getUploadUrl],
  );

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError('');
      setSuccess('');
      const result = await updateSettings({
        input: {
          bannerUrl: bannerUrl || null,
          tagline: tagline.trim() || null,
        },
      });
      setSaving(false);
      if (result.error) {
        setError(result.error.graphQLErrors?.[0]?.message || result.error.message);
      } else {
        setSuccess('Site settings saved!');
        setTimeout(() => setSuccess(''), 3000);
      }
    },
    [bannerUrl, tagline, updateSettings],
  );

  if (!ready || !user) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className={styles.page}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p className={styles.error}>You must be an admin to access this page.</p>
        </div>
      </div>
    );
  }

  if (fetching && !formInitialized) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href="/settings/profile" className={styles.backLink}>
          ← Back to settings
        </Link>
        <h1 className={styles.title}>🌐 Site Settings</h1>

        {success && <div className={styles.success}>{success}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSave}>
          {/* Banner */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Homepage Banner</h2>
            <p className={styles.sectionDesc}>
              Shown at the top of the SpotterSpace homepage. Recommended: 1500×400px or similar wide image.
            </p>
            <div className={styles.bannerPreview}>
              {bannerUrl ? (
                <img src={bannerUrl} alt="Site banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className={styles.bannerPlaceholder}>No banner set</div>
              )}
              {bannerUploading && (
                <div className={styles.bannerOverlay}>
                  <span>Uploading…</span>
                </div>
              )}
            </div>
            <div className={styles.bannerActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
              >
                {bannerUploading ? 'Uploading…' : bannerUrl ? 'Change Banner' : 'Upload Banner'}
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#f87171' }}
                  onClick={() => setBannerUrl('')}
                >
                  Remove
                </button>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBannerChange}
              />
            </div>
          </div>

          {/* Tagline */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Tagline</h2>
            <p className={styles.sectionDesc}>
              Short tagline shown below the site name on the homepage.
            </p>
            <input
              type="text"
              className={styles.input}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="The world's community for aviation photography"
              maxLength={120}
              style={{ width: '100%' }}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

