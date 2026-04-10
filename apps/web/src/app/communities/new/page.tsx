'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_COMMUNITY } from '@/lib/queries';

import styles from '../page.module.css';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export default function NewCommunityPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [, createCommunity] = useMutation(CREATE_COMMUNITY);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [visibility, setVisibility] = useState('public');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (ready && !user) {
    router.push('/login');
    return null;
  }

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManual) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await createCommunity({
      input: {
        name,
        slug,
        description: description || undefined,
        category,
        visibility,
        location: location || undefined,
      },
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message || result.error.message);
      return;
    }

    router.push(`/communities/${result.data.createCommunity.slug}`);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create a Community</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. LAX Spotters"
            required
            minLength={3}
            maxLength={100}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Slug (URL-friendly)</label>
          <input
            className={styles.input}
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            placeholder="lax-spotters"
            required
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this community about?"
            maxLength={2000}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Category</label>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="general">General</option>
            <option value="airliners">Airliners</option>
            <option value="military">Military</option>
            <option value="general-aviation">General Aviation</option>
            <option value="helicopters">Helicopters</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Visibility</label>
          <select
            className={styles.select}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Public — anyone can join</option>
            <option value="invite_only">Invite Only — requires an invite code</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Location (optional)</label>
          <input
            className={styles.input}
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Los Angeles, CA"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Community'}
        </button>
      </form>
    </div>
  );
}
