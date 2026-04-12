'use client';

import Link from 'next/link';
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_PHOTO, GET_ME, GET_UPLOAD_URL, SEARCH_AIRCRAFT_TYPES } from '@/lib/queries';

import styles from './page.module.css';

type UploadStep = 'select' | 'uploading' | 'form' | 'creating' | 'done';

export default function UploadPage() {
  const { user, ready } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, getUploadUrl] = useMutation(GET_UPLOAD_URL);
  const [, createPhoto] = useMutation(CREATE_PHOTO);

  // Fetch user's gear list
  const [meResult] = useQuery({ query: GET_ME });
  const cameraBodies: string[] = meResult.data?.me?.profile?.cameraBodies ?? [];
  const lenses: string[] = meResult.data?.me?.profile?.lenses ?? [];

  // Aircraft typeahead
  const [aircraftTypeSearch, setAircraftTypeSearch] = useState('');
  const [aircraftTypeResults, setAircraftTypeResults] = useState<Array<{
    id: string;
    manufacturer: string;
    aircraftName: string;
    iataCode: string | null;
    icaoCode: string | null;
  }>>([]);
  const [showAircraftTypeDropdown, setShowAircraftTypeDropdown] = useState(false);
  const aircraftTypeSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aircraftTypeSearchResult] = useQuery({
    query: SEARCH_AIRCRAFT_TYPES,
    variables: { search: aircraftTypeSearch, first: 10 },
    pause: aircraftTypeSearch.length < 1,
  });

  useEffect(() => {
    if (aircraftTypeSearchResult.data?.aircraftTypes?.edges) {
      setAircraftTypeResults(
        aircraftTypeSearchResult.data.aircraftTypes.edges.map(
          (e: { node: { id: string; manufacturer: string; aircraftName: string; iataCode: string | null; icaoCode: string | null } }) => e.node,
        ),
      );
    } else {
      setAircraftTypeResults([]);
    }
  }, [aircraftTypeSearchResult.data]);

  // Debounce aircraft type search
  const handleAircraftTypeSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAircraftTypeSearch(val);
    setAircraftTypeId('');
    if (aircraftTypeSearchRef.current) clearTimeout(aircraftTypeSearchRef.current);
    if (val.length > 0) {
      setShowAircraftTypeDropdown(true);
    } else {
      setShowAircraftTypeDropdown(false);
    }
  };

  const selectAircraftType = (at: { id: string; manufacturer: string; aircraftName: string }) => {
    setAircraftTypeId(at.id);
    setAircraftType(`${at.manufacturer} ${at.aircraftName}`);
    setAircraftTypeSearch(`${at.manufacturer} ${at.aircraftName}`);
    setShowAircraftTypeDropdown(false);
  };

  // State
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPhotoId, setCreatedPhotoId] = useState<string | null>(null);

  // Metadata form
  const [caption, setCaption] = useState('');
  const [aircraftTypeId, setAircraftTypeId] = useState('');
  const [aircraftType, setAircraftType] = useState('');
  const [airline, setAirline] = useState('');
  const [airportCode, setAirportCode] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [gearBody, setGearBody] = useState('');
  const [gearBodyCustom, setGearBodyCustom] = useState('');
  const [gearLens, setGearLens] = useState('');
  const [gearLensCustom, setGearLensCustom] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationPrivacy, setLocationPrivacy] = useState('exact');

  // ── File Selection ──────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setError(null);
      setFile(selectedFile);

      // Create preview
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      // Upload to S3
      setStep('uploading');
      setUploadProgress(10);

      const result = await getUploadUrl({
        input: {
          mimeType: selectedFile.type,
          fileSizeBytes: selectedFile.size,
        },
      });

      if (result.error) {
        setError(
          result.error.graphQLErrors[0]?.message ?? 'Failed to get upload URL',
        );
        setStep('select');
        return;
      }

      const { url: presignedUrl, key } = result.data.getUploadUrl;
      setUploadProgress(30);

      // Upload file to S3 via presigned URL
      try {
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type },
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        setS3Key(key);
        setUploadProgress(100);
        setStep('form');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Upload failed',
        );
        setStep('select');
      }
    },
    [getUploadUrl],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type.startsWith('image/')) {
        handleFile(droppedFile);
      }
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile],
  );

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setS3Key(null);
    setStep('select');
    setUploadProgress(0);
    setAircraftTypeSearch('');
    setAircraftTypeId('');
    setTakenAt('');
    setGearBody('');
    setGearBodyCustom('');
    setGearLens('');
    setGearLensCustom('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Tags ────────────────────────────────────────────────────────────────

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags((prev) => [...prev, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  // ── Create Photo ───────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!s3Key || !file) return;

    setStep('creating');
    setError(null);

    const result = await createPhoto({
      input: {
        s3Key,
        mimeType: file.type,
        fileSizeBytes: file.size,
        caption: caption || undefined,
        aircraftType: aircraftType || undefined,
        airportCode: airportCode || undefined,
        takenAt: takenAt || undefined,
        tags: tags.length > 0 ? tags : undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        locationPrivacy: locationPrivacy !== 'exact' ? locationPrivacy : undefined,
        aircraftTypeId: aircraftTypeId || undefined,
        gearBody: gearBody === '__custom__' ? gearBodyCustom : gearBody || undefined,
        gearLens: gearLens === '__custom__' ? gearLensCustom : gearLens || undefined,
      },
    });

    if (result.error) {
      setError(
        result.error.graphQLErrors[0]?.message ?? 'Failed to create photo',
      );
      setStep('form');
      return;
    }

    setCreatedPhotoId(result.data.createPhoto.id);
    setStep('done');
  };

  // ── Auth Guard ─────────────────────────────────────────────────────────

  if (ready && !user) {
    return (
      <div className={styles.page}>
        <div className="container-narrow">
          <div className={styles.formSection} style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16 }}>
              You need to sign in to upload photos.
            </p>
            <Link href="/signin" className="btn btn-primary btn-lg">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>📷 Upload to My Collection</h1>
        <p className={styles.subtitle}>
          Photos you upload here go into your personal collection.
          To add photos to a community album, open the album and use &ldquo;Add Photos&rdquo; to pick from your existing photos.
        </p>

        {step === 'done' && createdPhotoId ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✅</div>
            <p className={styles.successText}>Photo uploaded successfully!</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link
                href={`/photos/${createdPhotoId}`}
                className="btn btn-primary btn-lg"
              >
                View photo
              </Link>
              <button
                onClick={() => {
                  clearFile();
                  setCaption('');
                  setAircraftTypeSearch('');
                  setAircraftTypeId('');
                  setAircraftType('');
                  setAirportCode('');
                  setTakenAt('');
                  setGearBody('');
                  setGearBodyCustom('');
                  setGearLens('');
                  setGearLensCustom('');
                  setTags([]);
                  setLatitude('');
                  setLongitude('');
                  setLocationPrivacy('exact');
                  setCreatedPhotoId(null);
                }}
                className="btn btn-secondary btn-lg"
                type="button"
              >
                Upload another
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.twoCol}>
            {/* Left: Image area */}
            <div>
              {!file ? (
                <div
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneDragOver : ''}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className={styles.dropzoneIcon}>📸</div>
                  <p className={styles.dropzoneText}>
                    Drop your photo here or click to browse
                  </p>
                  <p className={styles.dropzoneSub}>
                    JPEG, PNG, WebP, HEIC — max 25 MB
                  </p>
                  <input
                    ref={fileInputRef}
                    data-testid="file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={handleFileInput}
                    hidden
                  />
                </div>
              ) : (
                <div className={styles.preview}>
                  {preview && (
                    <img
                      src={preview}
                      alt="Upload preview"
                      className={styles.previewImage}
                    />
                  )}
                  {step !== 'creating' && (
                    <button
                      onClick={clearFile}
                      className={styles.previewRemove}
                      type="button"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {step === 'uploading' && (
                <div className={styles.progress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>
                    Uploading… {uploadProgress}%
                  </p>
                </div>
              )}
            </div>

            {/* Right: Metadata form */}
            <div className={styles.formSection}>
              <h2 className={styles.formTitle}>Photo Details</h2>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="caption" className="label">
                    Caption
                  </label>
                  <textarea
                    id="caption"
                    className="input"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    placeholder="Describe your photo…"
                    maxLength={500}
                  />
                </div>

                <div className="field">
                  <label htmlFor="aircraftTypeSearch" className="label">
                    Aircraft Type
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="aircraftTypeSearch"
                      type="text"
                      className="input"
                      value={aircraftTypeSearch}
                      onChange={handleAircraftTypeSearchChange}
                      onFocus={() => aircraftTypeSearch.length > 0 && setShowAircraftTypeDropdown(true)}
                      placeholder="Search aircraft type (e.g. Boeing 747)"
                      autoComplete="off"
                    />
                    {showAircraftTypeDropdown && aircraftTypeResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          zIndex: 100,
                          maxHeight: 240,
                          overflowY: 'auto',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      >
                        {aircraftTypeResults.map((at) => (
                          <button
                            key={at.id}
                            type="button"
                            onClick={() => selectAircraftType(at)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--color-border)',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{at.manufacturer} {at.aircraftName}</span>
                            <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                              {at.iataCode ? `IATA: ${at.iataCode}` : ''}
                              {at.icaoCode ? ` ICAO: ${at.icaoCode}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showAircraftTypeDropdown && aircraftTypeSearch.length > 0 && aircraftTypeResults.length === 0 && !aircraftTypeSearchResult.fetching && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          zIndex: 100,
                          padding: '8px 12px',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        No aircraft type found
                      </div>
                    )}
                  </div>
                  {aircraftTypeSearchResult.fetching && aircraftTypeSearch.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      Searching…
                    </p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="airline" className="label">
                    Airline
                  </label>
                  <input
                    id="airline"
                    type="text"
                    className="input"
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    placeholder="e.g. Lufthansa"
                  />
                </div>

                <div className="field">
                  <label htmlFor="takenAt" className="label">
                    Date Taken
                  </label>
                  <input
                    id="takenAt"
                    type="datetime-local"
                    className="input"
                    value={takenAt}
                    onChange={(e) => setTakenAt(e.target.value)}
                  />
                </div>

                <div className={styles.gearRow}>
                  <div className="field">
                    <label htmlFor="gearBody" className="label">
                      Camera Body
                    </label>
                    <select
                      id="gearBody"
                      className="input"
                      value={gearBody}
                      onChange={(e) => setGearBody(e.target.value)}
                    >
                      <option value="">Select body…</option>
                      {cameraBodies.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="__custom__">Other (enter below)…</option>
                    </select>
                    {gearBody === '__custom__' && (
                      <input
                        type="text"
                        className="input"
                        style={{ marginTop: 6 }}
                        placeholder="Enter camera body"
                        value={gearBodyCustom}
                        onChange={(e) => setGearBodyCustom(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="gearLens" className="label">
                      Lens
                    </label>
                    <select
                      id="gearLens"
                      className="input"
                      value={gearLens}
                      onChange={(e) => setGearLens(e.target.value)}
                    >
                      <option value="">Select lens…</option>
                      {lenses.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                      <option value="__custom__">Other (enter below)…</option>
                    </select>
                    {gearLens === '__custom__' && (
                      <input
                        type="text"
                        className="input"
                        style={{ marginTop: 6 }}
                        placeholder="Enter lens"
                        value={gearLensCustom}
                        onChange={(e) => setGearLensCustom(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="airportCode" className="label">
                    Airport Code
                  </label>
                  <input
                    id="airportCode"
                    type="text"
                    className="input"
                    value={airportCode}
                    onChange={(e) =>
                      setAirportCode(e.target.value.toUpperCase())
                    }
                    placeholder="KSFO"
                    maxLength={4}
                  />
                </div>

                <div className="field">
                  <label className="label">📍 Location</label>
                  <div className={styles.locationRow}>
                    <input
                      type="number"
                      className="input"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="Latitude"
                      step="any"
                      min={-90}
                      max={90}
                    />
                    <input
                      type="number"
                      className="input"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="Longitude"
                      step="any"
                      min={-180}
                      max={180}
                    />
                  </div>
                </div>

                {(latitude || longitude) && (
                  <div className="field">
                    <label htmlFor="locationPrivacy" className="label">
                      Location Privacy
                    </label>
                    <select
                      id="locationPrivacy"
                      className="input"
                      value={locationPrivacy}
                      onChange={(e) => setLocationPrivacy(e.target.value)}
                    >
                      <option value="exact">Exact</option>
                      <option value="approximate">Approximate (~1 km offset)</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="tags" className="label">
                    Tags
                  </label>
                  <div className={styles.tagsInput}>
                    <input
                      id="tags"
                      type="text"
                      className="input"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add tags (press Enter)"
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className={styles.tagsList}>
                      {tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                          <button
                            type="button"
                            className={styles.tagRemove}
                            onClick={() => removeTag(tag)}
                            aria-label={`Remove tag ${tag}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && <p className="error-text">{error}</p>}

                <div className={styles.actions}>
                  <button
                    type="submit"
                    disabled={
                      step === 'creating' ||
                      step === 'uploading' ||
                      !s3Key
                    }
                    className="btn btn-primary btn-lg"
                  >
                    {step === 'creating'
                      ? 'Publishing…'
                      : 'Publish Photo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
