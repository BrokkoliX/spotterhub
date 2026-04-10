'use client';

import Link from 'next/link';
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_PHOTO, GET_UPLOAD_URL } from '@/lib/queries';

import styles from './page.module.css';

type UploadStep = 'select' | 'uploading' | 'form' | 'creating' | 'done';

export default function UploadPage() {
  const { user, ready } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, getUploadUrl] = useMutation(GET_UPLOAD_URL);
  const [, createPhoto] = useMutation(CREATE_PHOTO);

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
  const [aircraftType, setAircraftType] = useState('');
  const [airline, setAirline] = useState('');
  const [airportCode, setAirportCode] = useState('');
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
        airline: airline || undefined,
        airportCode: airportCode || undefined,
        tags: tags.length > 0 ? tags : undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        locationPrivacy: locationPrivacy !== 'exact' ? locationPrivacy : undefined,
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
        <h1 className={styles.title}>Upload Photo</h1>

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
                  setAircraftType('');
                  setAirline('');
                  setAirportCode('');
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
                  <label htmlFor="aircraftType" className="label">
                    Aircraft Type
                  </label>
                  <input
                    id="aircraftType"
                    type="text"
                    className="input"
                    value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)}
                    placeholder="e.g. Boeing 747-8"
                  />
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
