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
  useMemo,
} from 'react';
import { useMutation, useQuery } from 'urql';
import exifr from 'exifr';

import { useAuth } from '@/lib/auth';
import SearchableSelect from '@/components/SearchableSelect';
import {
  CREATE_PHOTO,
  GET_ME,
  GET_UPLOAD_URL,
  GET_PHOTO_CATEGORIES,
  GET_AIRCRAFT_SPECIFIC_CATEGORIES,
  SEARCH_AIRCRAFT_REGISTRATIONS,
  GET_AIRPORT_BY_ICAO,
  GET_AIRCRAFT_MANUFACTURERS,
  GET_AIRCRAFT_FAMILIES,
  GET_AIRCRAFT_VARIANTS,
  GET_AIRLINES,
} from '@/lib/queries';
import dynamic from 'next/dynamic';
import AirportPicker, { type Airport } from '@/components/AirportPicker';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

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

  // Fetch categories
  const [categoriesResult] = useQuery({ query: GET_PHOTO_CATEGORIES });
  const photoCategories = categoriesResult.data?.photoCategories ?? [];
  const [specificCategoriesResult] = useQuery({ query: GET_AIRCRAFT_SPECIFIC_CATEGORIES });
  const aircraftSpecificCategories = specificCategoriesResult.data?.aircraftSpecificCategories ?? [];

  // Aircraft hierarchy dropdowns
  const [manufacturersResult] = useQuery({ query: GET_AIRCRAFT_MANUFACTURERS, variables: { first: 10000 } });
  const manufacturers = manufacturersResult.data?.aircraftManufacturers?.edges?.map(
    (e: { node: { id: string; name: string; country: string | null } }) => e.node,
  ) ?? [];

  const [familiesResult] = useQuery({ query: GET_AIRCRAFT_FAMILIES, variables: { first: 10000 } });
  const allFamilies = familiesResult.data?.aircraftFamilies?.edges?.map(
    (e: { node: { id: string; name: string; manufacturer: { id: string; name: string } } }) => ({
      ...e.node,
      label: `${e.node.name} (${e.node.manufacturer.name})`,
    }),
  ) ?? [];

  const [variantsResult] = useQuery({ query: GET_AIRCRAFT_VARIANTS, variables: { first: 10000 } });
  const allVariants = variantsResult.data?.aircraftVariants?.edges?.map(
    (e: { node: { id: string; name: string; iataCode: string | null; icaoCode: string | null; family: { id: string; name: string } } }) => ({
      ...e.node,
      label: `${e.node.name} (${e.node.family.name})`,
    }),
  ) ?? [];

  const [airlinesResult] = useQuery({ query: GET_AIRLINES, variables: { first: 10000 } });
  const airlines = airlinesResult.data?.airlines?.edges?.map(
    (e: { node: { id: string; name: string; icaoCode: string; iataCode: string | null; country: string | null } }) => e.node,
  ) ?? [];

  // Cascaded dropdown state
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedAirlineId, setSelectedAirlineId] = useState('');

  // Filtered dropdown lists
  const filteredFamilies = useMemo(
    () => (selectedManufacturerId
      ? allFamilies.filter((f: { manufacturer: { id: string } }) => f.manufacturer.id === selectedManufacturerId)
      : allFamilies),
    [selectedManufacturerId, allFamilies],
  );

  const filteredVariants = useMemo(
    () => (selectedFamilyId
      ? allVariants.filter((v: { family: { id: string } }) => v.family.id === selectedFamilyId)
      : allVariants),
    [selectedFamilyId, allVariants],
  );

  // Registration typeahead (for auto-fill)
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationResults, setRegistrationResults] = useState<Array<{
    id: string;
    registration: string;
    manufacturer: { id: string; name: string } | null;
    family: { id: string; name: string } | null;
    variant: { id: string; name: string; iataCode: string | null; icaoCode: string | null } | null;
    airlineRef: { name: string; icaoCode: string; iataCode: string | null } | null;
    msn: string | null;
    manufacturingDate: string | null;
    operatorType: string | null;
  }>>([]);
  const [showRegistrationDropdown, setShowRegistrationDropdown] = useState(false);
  const registrationSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [registrationSearchResult] = useQuery({
    query: SEARCH_AIRCRAFT_REGISTRATIONS,
    variables: { search: registrationSearch, first: 10 },
    pause: registrationSearch.length < 1,
  });

  useEffect(() => {
    if (registrationSearchResult.data?.aircraftSearch?.edges) {
      setRegistrationResults(
        registrationSearchResult.data.aircraftSearch.edges.map(
          (e: { node: { id: string; registration: string; manufacturer: { name: string } | null; family: { name: string } | null; variant: { name: string; iataCode: string | null; icaoCode: string | null } | null; airlineRef: { name: string; icaoCode: string; iataCode: string | null } | null; msn: string | null; manufacturingDate: string | null; operatorType: string | null } }) => e.node,
        ),
      );
    } else {
      setRegistrationResults([]);
    }
  }, [registrationSearchResult.data]);

  const handleRegistrationSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setRegistrationSearch(val);
    if (registrationSearchRef.current) clearTimeout(registrationSearchRef.current);
    if (val.length > 0) {
      setShowRegistrationDropdown(true);
    } else {
      setShowRegistrationDropdown(false);
    }
  };

  const selectRegistration = (aircraft: typeof registrationResults[0]) => {
    setRegistrationSearch(aircraft.registration);
    setShowRegistrationDropdown(false);
    // Set aircraftId (links to the Aircraft registration record)
    setAircraftId(aircraft.id);
    // Capture hierarchy fields
    if (aircraft.manufacturer) setSelectedManufacturerId(aircraft.manufacturer.id);
    if (aircraft.family) setSelectedFamilyId(aircraft.family.id);
    if (aircraft.variant) setSelectedVariantId(aircraft.variant.id);
    // Capture operatorType, msn, manufacturingDate from the Aircraft record
    if (aircraft.operatorType) setOperatorType(aircraft.operatorType);
    if (aircraft.msn) setMsn(aircraft.msn);
    if (aircraft.manufacturingDate) setManufacturingDate(aircraft.manufacturingDate);
    // Auto-fill airline from airlineRef
    if (aircraft.airlineRef) {
      setSelectedAirlineId(aircraft.airlineRef.icaoCode);
      setAirlineDisplay(`${aircraft.airlineRef.name} (${[aircraft.airlineRef.iataCode, aircraft.airlineRef.icaoCode].filter(Boolean).join('/')})`);
    }
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
  const [aircraftId, setAircraftId] = useState('');
  const [operatorType, setOperatorType] = useState('');
  const [msn, setMsn] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
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
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [mapPosition, setMapPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [photoCategoryId, setPhotoCategoryId] = useState('');
  const [aircraftSpecificCategoryId, setAircraftSpecificCategoryId] = useState('');
  const [locationType, setLocationType] = useState('');
  const [exifData, setExifData] = useState<Record<string, unknown> | null>(null);
  const [airlineDisplay, setAirlineDisplay] = useState(''); // shown below airline dropdown

  // Try to get device location on mount to set initial map center
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {}, // silently ignore — keep default center
    );
  }, []);

  // Airport picker handler — sets airport code + coordinates
  const handleAirportSelect = (airport: Airport | null) => {
    setSelectedAirport(airport);
    if (airport) {
      setAirportCode(airport.icaoCode);
      setLatitude(String(airport.latitude));
      setLongitude(String(airport.longitude));
      setMapPosition({ lat: airport.latitude, lng: airport.longitude });
    }
  };

  // Map picker handler — sets coordinates + clears airport selection
  const handleMapSelect = (lat: number, lng: number) => {
    setMapPosition({ lat, lng });
    setLatitude(String(lat));
    setLongitude(String(lng));
    setSelectedAirport(null);
    setAirportCode('');
  };

  // ── File Selection ──────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setError(null);
      setFile(selectedFile);

      // Create preview
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      // Extract EXIF data
      try {
        const exif = await exifr.parse(selectedFile, {
          tiff: true, exif: true, gps: true,
          pick: ['Make', 'Model', 'FocalLength', 'FocalLengthIn35mmFormat', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'],
        });
        if (exif) {
          setExifData({
            make: exif.Make ?? null,
            model: exif.Model ?? null,
            focalLength: exif.FocalLength ? String(exif.FocalLength) : null,
            focalLength35mm: exif.FocalLengthIn35mmFormat ? String(exif.FocalLengthIn35mmFormat) : null,
            aperture: exif.FNumber ? String(exif.FNumber) : null,
            shutterSpeed: exif.ExposureTime ? String(exif.ExposureTime) : null,
            iso: exif.ISO ? String(exif.ISO) : null,
            takenAt: exif.DateTimeOriginal ? exif.DateTimeOriginal.toISOString().split('T')[0] : null,
          });
        }
      } catch {
        // EXIF extraction is best-effort
      }

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
    setTakenAt('');
    setGearBody('');
    setGearBodyCustom('');
    setGearLens('');
    setGearLensCustom('');
    setPhotoCategoryId('');
    setAircraftSpecificCategoryId('');
    setOperatorType('');
    setMsn('');
    setManufacturingDate('');
    setAirlineDisplay('');
    setRegistrationSearch('');
    setLocationType('');
    setExifData(null);
    setAircraftId('');
    setSelectedManufacturerId('');
    setSelectedFamilyId('');
    setSelectedVariantId('');
    setSelectedAirlineId('');
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

    const input: Record<string, unknown> = {
      s3Key,
      mimeType: file.type,
      fileSizeBytes: file.size,
    };
    if (caption) input.caption = caption;
    if (aircraftId) input.aircraftId = aircraftId;
    if (airportCode) input.airportCode = airportCode;
    if (takenAt) input.takenAt = takenAt;
    if (tags.length > 0) input.tags = tags;
    if (latitude) input.latitude = parseFloat(latitude);
    if (longitude) input.longitude = parseFloat(longitude);
    if (locationPrivacy !== 'exact') input.locationPrivacy = locationPrivacy;
    if (gearBody === '__custom__' ? gearBodyCustom : gearBody) input.gearBody = gearBody === '__custom__' ? gearBodyCustom : gearBody;
    if (gearLens === '__custom__' ? gearLensCustom : gearLens) input.gearLens = gearLens === '__custom__' ? gearLensCustom : gearLens;
    if (photoCategoryId) input.photoCategoryId = photoCategoryId;
    if (aircraftSpecificCategoryId) input.aircraftSpecificCategoryId = aircraftSpecificCategoryId;
    if (selectedAirlineId) input.operatorIcao = selectedAirlineId;
    if (operatorType) input.operatorType = operatorType.toUpperCase();
    if (msn) input.msn = msn;
    if (manufacturingDate) input.manufacturingDate = manufacturingDate;
    if (locationType) input.locationType = locationType;
    if (exifData && Object.keys(exifData).length > 0) input.exifData = exifData;

    const result = await createPhoto({ input });

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
                  setOperatorType('');
                  setMsn('');
                  setManufacturingDate('');
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
                  setPhotoCategoryId('');
                  setAircraftSpecificCategoryId('');
                  setAirlineDisplay('');
                  setRegistrationSearch('');
                  setLocationType('');
                  setAircraftId('');
                  setExifData(null);
                  setCreatedPhotoId(null);
                  setSelectedManufacturerId('');
                  setSelectedFamilyId('');
                  setSelectedVariantId('');
                  setSelectedAirlineId('');
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
                  <label htmlFor="registration" className="label">
                    Registration (auto-fill)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="registration"
                      type="text"
                      className="input"
                      value={registrationSearch}
                      onChange={handleRegistrationSearchChange}
                      placeholder="e.g. N12345"
                      style={{ textTransform: 'uppercase' }}
                    />
                    {showRegistrationDropdown && registrationResults.length > 0 && (
                      <div style={{
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
                      }}>
                        {registrationResults.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => selectRegistration(a)}
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
                            <span style={{ fontWeight: 600 }}>{a.registration}</span>
                            <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>
                              {[a.manufacturer?.name, a.family?.name, a.variant?.name].filter(Boolean).join(' ')}
                              {a.variant?.iataCode || a.variant?.icaoCode
                                ? ` (${[a.variant.iataCode, a.variant.icaoCode].filter(Boolean).join('/')})`
                                : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Aircraft Details — collapsible section */}
                <details className={styles.aircraftDetails}>
                  <summary className={styles.aircraftDetailsSummary}>
                    ✈ Aircraft Details
                  </summary>
                  <div className={styles.aircraftDetailsBody}>
                    <div className={styles.aircraftRow}>
                      <div className="field">
                        <label htmlFor="manufacturer" className="label">
                          Manufacturer
                        </label>
                        <SearchableSelect
                          options={manufacturers.map((m: { id: string; name: string }) => ({ id: m.id, label: m.name }))}
                          value={selectedManufacturerId}
                          onChange={(id) => {
                            setSelectedManufacturerId(id);
                            setSelectedFamilyId('');
                            setSelectedVariantId('');
                          }}
                          placeholder="Search manufacturer…"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="family" className="label">
                          Family
                        </label>
                        <SearchableSelect
                          options={filteredFamilies.map((f: { id: string; label: string }) => ({ id: f.id, label: f.label }))}
                          value={selectedFamilyId}
                          onChange={(id) => {
                            setSelectedFamilyId(id);
                            setSelectedVariantId('');
                          }}
                          placeholder="Search family…"
                        />
                      </div>
                    </div>

                    <div className={styles.aircraftRow}>
                      <div className="field">
                        <label htmlFor="variant" className="label">
                          Variant
                        </label>
                        <SearchableSelect
                          options={filteredVariants.map((v: { id: string; label: string }) => ({ id: v.id, label: v.label }))}
                          value={selectedVariantId}
                          onChange={(id) => setSelectedVariantId(id)}
                          placeholder="Search variant…"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="operatorType" className="label">
                          Operator Type
                        </label>
                        <select
                          id="operatorType"
                          className="input"
                          value={operatorType}
                          onChange={(e) => setOperatorType(e.target.value)}
                        >
                          <option value="">Select type…</option>
                          <option value="airline">Airline</option>
                          <option value="general_aviation">General Aviation</option>
                          <option value="military">Military</option>
                          <option value="government">Government</option>
                          <option value="cargo">Cargo</option>
                          <option value="charter">Charter</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.aircraftRow}>
                      <div className="field">
                        <label htmlFor="msn" className="label">
                          MSN / Serial Number
                        </label>
                        <input
                          id="msn"
                          type="text"
                          className="input"
                          value={msn}
                          onChange={(e) => setMsn(e.target.value)}
                          placeholder="e.g. 12345"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="manufacturingDate" className="label">
                          Manufacturing Date
                        </label>
                        <input
                          id="manufacturingDate"
                          type="date"
                          className="input"
                          value={manufacturingDate}
                          onChange={(e) => setManufacturingDate(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="airlineRef" className="label">
                          Airline
                        </label>
                        <SearchableSelect
                          options={airlines.map((a: { id: string; name: string; icaoCode: string; iataCode: string | null; country: string | null }) => ({
                            id: a.icaoCode,
                            label: `${a.name} (${a.icaoCode}${a.iataCode ? `/${a.iataCode}` : ''})`,
                          }))}
                          value={selectedAirlineId}
                          onChange={(id) => setSelectedAirlineId(id)}
                          placeholder="Search airline…"
                        />
                      </div>
                    </div>
                  </div>
                </details>

                <div className="field">
                  <label htmlFor="takenAt" className="label">
                    Date Taken
                  </label>
                  <input
                    id="takenAt"
                    type="date"
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

                <div className={styles.gearRow}>
                  <div className="field">
                    <label htmlFor="photoCategory" className="label">
                      Photo Category
                    </label>
                    <SearchableSelect
                      options={photoCategories.map((c: { id: string; name: string; label: string }) => ({ id: c.id, label: c.label }))}
                      value={photoCategoryId}
                      onChange={(id) => setPhotoCategoryId(id)}
                      placeholder="Search category…"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="aircraftSpecificCategory" className="label">
                      Aircraft Type
                    </label>
                    <SearchableSelect
                      options={aircraftSpecificCategories.map((c: { id: string; name: string; label: string }) => ({ id: c.id, label: c.label }))}
                      value={aircraftSpecificCategoryId}
                      onChange={(id) => setAircraftSpecificCategoryId(id)}
                      placeholder="Search aircraft type…"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="label">📍 Airport (optional)</label>
                  <AirportPicker value={selectedAirport} onChange={handleAirportSelect} />
                </div>

                <div className="field">
                  <label className="label">📍 Or pick a location on the map</label>
                  <MapPicker position={mapPosition} onSelect={handleMapSelect} />
                  {mapPosition && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                      {mapPosition.lat.toFixed(4)}°, {mapPosition.lng.toFixed(4)}° — drag marker to adjust
                    </p>
                  )}
                  {!mapPosition && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                      Click the map to set a location
                    </p>
                  )}
                </div>

                {mapPosition && !selectedAirport && (
                  <div className="field">
                    <label htmlFor="locationType" className="label">
                      Location Type
                    </label>
                    <select
                      id="locationType"
                      className="input"
                      value={locationType}
                      onChange={(e) => setLocationType(e.target.value)}
                    >
                      <option value="">Select type…</option>
                      <option value="museum">Museum</option>
                      <option value="cemetery">Cemetery</option>
                      <option value="airfield">Airfield</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}

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
