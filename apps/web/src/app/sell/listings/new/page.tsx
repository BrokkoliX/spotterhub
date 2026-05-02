'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  GET_ME,
  GET_MARKETPLACE_CATEGORIES,
  GET_MARKETPLACE_UPLOAD_URL,
  CREATE_MARKETPLACE_ITEM,
} from '@/lib/queries';
import { MultipleImageUploader } from '@/components/MultipleImageUploader';

import styles from './page.module.css';

interface Category {
  id: string;
  name: string;
  label: string;
}

const CONDITIONS = [
  { value: 'mint', label: 'Mint', desc: 'Like new, no visible wear' },
  { value: 'excellent', label: 'Excellent', desc: 'Minor signs of use' },
  { value: 'good', label: 'Good', desc: 'Normal wear, fully functional' },
  { value: 'fair', label: 'Fair', desc: 'Noticeable wear, works fine' },
  { value: 'poor', label: 'Poor', desc: 'Heavy wear, may have issues' },
];

export default function NewListingPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [{ data: meData, fetching: meFetching }] = useQuery({
    query: GET_ME,
    pause: !ready || !user,
  });

  const [{ data: categoriesData, fetching: categoriesFetching }] = useQuery({
    query: GET_MARKETPLACE_CATEGORIES,
  });
  const categories: Category[] = categoriesData?.marketplaceCategories ?? [];

  const [{ fetching: creating }, createMutation] = useMutation(CREATE_MARKETPLACE_ITEM);

  const [, getUploadUrl] = useMutation(GET_MARKETPLACE_UPLOAD_URL);

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [imageS3Keys, setImageS3Keys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user is not a fully active seller
  useEffect(() => {
    if (!ready || !user || meFetching) return;
    const sellerProfile = meData?.me?.sellerProfile;
    if (!sellerProfile) {
      router.replace('/sell');
      return;
    }
    if (!sellerProfile.approved) {
      router.replace('/settings/seller');
      return;
    }
    if (!sellerProfile.stripeOnboardingComplete && sellerProfile.stripeAccountId) {
      router.replace('/settings/seller');
      return;
    }
  }, [ready, user, meFetching, meData, router]);

  const uploadUrlFn = async (file: File): Promise<string> => {
    const result = await getUploadUrl({
      input: { mimeType: file.type, fileSizeBytes: file.size },
    });
    if (result.error || !result.data?.getMarketplaceItemUploadUrl) {
      throw new Error(result.error?.graphQLErrors?.[0]?.message ?? 'Failed to get upload URL');
    }
    const { url, key } = result.data.getMarketplaceItemUploadUrl;
    await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    return key;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) { setError('Please select a category'); return; }
    if (!title.trim()) { setError('Please enter a title'); return; }
    if (!priceUsd) { setError('Please enter a price'); return; }
    if (!condition) { setError('Please select a condition'); return; }
    if (imageS3Keys.length === 0) { setError('Please upload at least one photo'); return; }

    setError(null);

    const result = await createMutation({
      input: {
        categoryId,
        title: title.trim(),
        description: description.trim() || null,
        priceUsd,
        condition,
        location: location.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        imageS3Keys,
      },
    });

    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to create listing');
      return;
    }

    router.push('/sell/listings');
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/sell/listings" className={styles.backLink}>← Back to listings</Link>
        <h1 className={styles.title}>Create New Listing</h1>
        <p className={styles.subtitle}>Fill in the details to list your item for sale.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Photos */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Photos <span className={styles.required}>*</span></h2>
            <p className={styles.sectionHint}>Add up to 8 photos. The first will be the cover image.</p>
            <MultipleImageUploader
              maxImages={8}
              uploadFn={uploadUrlFn}
              onImagesUploaded={setImageS3Keys}
            />
          </div>

          {/* Basic Info */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Item Details</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="category">Category <span className={styles.required}>*</span></label>
              <select
                id="category"
                className={styles.select}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select a category…</option>
                {categories.length === 0 && !categoriesFetching && (
                  <option value="" disabled>No categories available — contact admin</option>
                )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="title">Title <span className={styles.required}>*</span></label>
              <input
                id="title"
                type="text"
                className={styles.input}
                placeholder="e.g. 1:400 Boeing 747 model, Pan Am livery"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="description">Description</label>
              <textarea
                id="description"
                className={styles.textarea}
                placeholder="Describe the item in detail — condition, history, what's included…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
              />
            </div>
          </div>

          {/* Price & Condition */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Price & Condition</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="price">Price (USD) <span className={styles.required}>*</span></label>
              <div className={styles.priceInputWrap}>
                <span className={styles.pricePrefix}>$</span>
                <input
                  id="price"
                  type="number"
                  className={`${styles.input} ${styles.priceInput}`}
                  placeholder="0.00"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Condition <span className={styles.required}>*</span></label>
              <div className={styles.conditionGrid}>
                {CONDITIONS.map((cond) => (
                  <label
                    key={cond.value}
                    className={`${styles.conditionCard} ${condition === cond.value ? styles.conditionSelected : ''}`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={cond.value}
                      checked={condition === cond.value}
                      onChange={() => setCondition(cond.value)}
                      style={{ display: 'none' }}
                    />
                    <span className={styles.conditionLabel}>{cond.label}</span>
                    <span className={styles.conditionDesc}>{cond.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Shipping Location</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location">
                Region <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                className={styles.input}
                placeholder="e.g. California, USA or Europe-wide"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />
              <span className={styles.hint}>Buyers will see this to estimate shipping.</span>
            </div>
          </div>

          {/* Contact */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Contact Information</h2>
            <p className={styles.sectionHint}>This will be visible to buyers so they can reach you.</p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="contactEmail">Email <span className={styles.optional}>(optional)</span></label>
              <input
                id="contactEmail"
                type="email"
                className={styles.input}
                placeholder="buyers@yourdomain.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="contactPhone">Phone <span className={styles.optional}>(optional)</span></label>
              <input
                id="contactPhone"
                type="tel"
                className={styles.input}
                placeholder="+1 (555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Link href="/sell/listings" className="btn btn-secondary">Cancel</Link>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={creating || categoriesFetching}
            >
              {creating ? 'Creating…' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}