'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  GET_ME,
  GET_UPLOAD_URL,
  UPDATE_AVATAR,
  UPDATE_PROFILE,
} from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  locationRegion?: string | null;
  experienceLevel?: string | null;
  gear?: string | null;
  interests?: string[];
  favoriteAircraft?: string[];
  favoriteAirports?: string[];
  isPublic?: boolean;
  cameraBodies?: string[];
  lenses?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Join an array into a comma-separated string for form display. */
function arrayToInput(arr?: string[] | null): string {
  return arr?.join(', ') ?? '';
}

/** Split a comma-separated string into a trimmed array (filtering blanks). */
function inputToArray(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const S3_ENDPOINT = 'http://localhost:4566';
const S3_BUCKET = 'spotterspace-photos';

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProfileSettingsPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [gear, setGear] = useState('');
  const [interests, setInterests] = useState('');
  const [favoriteAircraft, setFavoriteAircraft] = useState('');
  const [favoriteAirports, setFavoriteAirports] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [cameraBodies, setCameraBodies] = useState<string[]>([]);
  const [lenses, setLenses] = useState<string[]>([]);
  const [newCameraBody, setNewCameraBody] = useState('');
  const [newLens, setNewLens] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);

  // Queries & mutations
  const [meResult] = useQuery({ query: GET_ME, pause: !ready || !user });
  const [, executeUpdateProfile] = useMutation(UPDATE_PROFILE);
  const [, executeUpdateAvatar] = useMutation(UPDATE_AVATAR);
  const [, executeGetUploadUrl] = useMutation(GET_UPLOAD_URL);

  // Redirect if not authenticated
  useEffect(() => {
    if (ready && !user) {
      router.push('/signin');
    }
  }, [ready, user, router]);

  // Populate form from query data (once)
  useEffect(() => {
    if (meResult.data?.me?.profile && !formInitialized) {
      const p: ProfileData = meResult.data.me.profile;
      setDisplayName(p.displayName ?? '');
      setBio(p.bio ?? '');
      setLocationRegion(p.locationRegion ?? '');
      setExperienceLevel(p.experienceLevel ?? '');
      setGear(p.gear ?? '');
      setInterests(arrayToInput(p.interests));
      setFavoriteAircraft(arrayToInput(p.favoriteAircraft));
      setFavoriteAirports(arrayToInput(p.favoriteAirports));
      setIsPublic(p.isPublic ?? true);
      setAvatarUrl(p.avatarUrl ?? null);
      setCameraBodies(p.cameraBodies ?? []);
      setLenses(p.lenses ?? []);
      setFormInitialized(true);
    }
  }, [meResult.data, formInitialized]);

  // ─── Avatar Upload ──────────────────────────────────────────────────────

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select an image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Avatar must be under 5 MB.');
        return;
      }

      setUploading(true);
      setErrorMsg(null);

      try {
        // 1. Get presigned URL
        const urlResult = await executeGetUploadUrl({
          input: { mimeType: file.type },
        });
        if (urlResult.error || !urlResult.data?.getUploadUrl) {
          throw new Error('Failed to get upload URL');
        }

        const { url, key } = urlResult.data.getUploadUrl;

        // 2. Upload to S3
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        // 3. Construct object URL and save
        const objectUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
        const avatarResult = await executeUpdateAvatar({ avatarUrl: objectUrl });
        if (avatarResult.error) {
          throw new Error(avatarResult.error.graphQLErrors?.[0]?.message ?? 'Failed to update avatar');
        }

        setAvatarUrl(objectUrl);
        setSuccessMsg('Avatar updated!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Avatar upload failed');
      } finally {
        setUploading(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [executeGetUploadUrl, executeUpdateAvatar],
  );

  // ─── Profile Save ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const result = await executeUpdateProfile({
        input: {
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          locationRegion: locationRegion.trim() || null,
          experienceLevel: experienceLevel || null,
          gear: gear.trim() || null,
          interests: inputToArray(interests),
          favoriteAircraft: inputToArray(favoriteAircraft),
          favoriteAirports: inputToArray(favoriteAirports),
          isPublic,
          cameraBodies,
          lenses,
        },
      });

      setSaving(false);

      if (result.error) {
        setErrorMsg(
          result.error.graphQLErrors?.[0]?.message ?? 'Failed to save profile',
        );
      } else {
        setSuccessMsg('Profile saved successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    },
    [
      displayName, bio, locationRegion, experienceLevel, gear,
      interests, favoriteAircraft, favoriteAirports, isPublic,
      executeUpdateProfile,
    ],
  );

  // ─── Loading / Auth Guard ──────────────────────────────────────────────

  if (!ready || !user) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (meResult.fetching && !formInitialized) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ maxWidth: 640 }}>
          <p className={styles.loading}>Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href={`/u/${user.username}/photos`} className={styles.backLink}>
          ← Back to profile
        </Link>
        <h1 className={styles.title}>Edit Profile</h1>

        {successMsg && <div className={styles.success}>{successMsg}</div>}
        {errorMsg && <div className={styles.error}>{errorMsg}</div>}

        {/* Avatar */}
        <div className={styles.avatarCard}>
          <div className={styles.avatarPreview}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your avatar" />
            ) : (
              '👤'
            )}
          </div>
          <div className={styles.avatarActions}>
            <button
              type="button"
              className={styles.avatarBtn}
              onClick={handleAvatarClick}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Change Avatar'}
            </button>
            <p>JPEG, PNG, or WebP. Max 5 MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Profile Form */}
        <div className={styles.formCard}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="displayName">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                className={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you want to be known"
                maxLength={50}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="bio">
                Bio
              </label>
              <textarea
                id="bio"
                className={styles.textarea}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself…"
                maxLength={500}
              />
              <span className={styles.hint}>{bio.length}/500</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="locationRegion">
                Location / Region
              </label>
              <input
                id="locationRegion"
                type="text"
                className={styles.input}
                value={locationRegion}
                onChange={(e) => setLocationRegion(e.target.value)}
                placeholder="e.g., Pacific Northwest, USA"
                maxLength={100}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="experienceLevel">
                Experience Level
              </label>
              <select
                id="experienceLevel"
                className={styles.select}
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="">— Select —</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="gear">
                Gear
              </label>
              <input
                id="gear"
                type="text"
                className={styles.input}
                value={gear}
                onChange={(e) => setGear(e.target.value)}
                placeholder="e.g., Canon R5 + RF 100-500mm"
                maxLength={200}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="interests">
                Interests
              </label>
              <input
                id="interests"
                type="text"
                className={styles.input}
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., commercial, military, cargo"
              />
              <span className={styles.hint}>Comma-separated</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="favoriteAircraft">
                Favorite Aircraft
              </label>
              <input
                id="favoriteAircraft"
                type="text"
                className={styles.input}
                value={favoriteAircraft}
                onChange={(e) => setFavoriteAircraft(e.target.value)}
                placeholder="e.g., A380, 747-8F, 787-9"
              />
              <span className={styles.hint}>Comma-separated</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="favoriteAirports">
                Favorite Airports
              </label>
              <input
                id="favoriteAirports"
                type="text"
                className={styles.input}
                value={favoriteAirports}
                onChange={(e) => setFavoriteAirports(e.target.value)}
                placeholder="e.g., KSEA, KLAX, EGLL"
              />
              <span className={styles.hint}>Comma-separated (ICAO codes)</span>
            </div>

            {/* Camera Bodies */}
            <div className={styles.field}>
              <label className={styles.label}>Camera Bodies</label>
              {cameraBodies.length > 0 && (
                <div className={styles.gearList}>
                  {cameraBodies.map((body) => (
                    <span key={body} className={styles.gearTag}>
                      {body}
                      <button
                        type="button"
                        className={styles.gearTagRemove}
                        onClick={() => setCameraBodies((prev) => prev.filter((b) => b !== body))}
                        aria-label={`Remove ${body}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.gearAddRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={newCameraBody}
                  onChange={(e) => setNewCameraBody(e.target.value)}
                  placeholder="e.g., Canon EOS R5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newCameraBody.trim()) {
                        setCameraBodies((prev) => [...prev, newCameraBody.trim()]);
                        setNewCameraBody('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.gearAddBtn}
                  onClick={() => {
                    if (newCameraBody.trim()) {
                      setCameraBodies((prev) => [...prev, newCameraBody.trim()]);
                      setNewCameraBody('');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Lenses */}
            <div className={styles.field}>
              <label className={styles.label}>Lenses</label>
              {lenses.length > 0 && (
                <div className={styles.gearList}>
                  {lenses.map((lens) => (
                    <span key={lens} className={styles.gearTag}>
                      {lens}
                      <button
                        type="button"
                        className={styles.gearTagRemove}
                        onClick={() => setLenses((prev) => prev.filter((l) => l !== lens))}
                        aria-label={`Remove ${lens}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.gearAddRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={newLens}
                  onChange={(e) => setNewLens(e.target.value)}
                  placeholder="e.g., Sigma 150-600mm f/5-6.3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newLens.trim()) {
                        setLenses((prev) => [...prev, newLens.trim()]);
                        setNewLens('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.gearAddBtn}
                  onClick={() => {
                    if (newLens.trim()) {
                      setLenses((prev) => [...prev, newLens.trim()]);
                      setNewLens('');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div className={styles.checkboxField}>
              <input
                id="isPublic"
                type="checkbox"
                className={styles.checkbox}
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label className={styles.checkboxLabel} htmlFor="isPublic">
                Make my profile public
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
