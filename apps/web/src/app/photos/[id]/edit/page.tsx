'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { GET_PHOTO, UPDATE_PHOTO } from '@/lib/queries';

/**
 * Photo edit page.
 *
 * Allows the photo owner, or any moderator/admin/superuser, to update the
 * most commonly-edited metadata fields on a photo: caption, airline, airport
 * code, the date the photo was taken, the tag list, and gear (body and lens).
 *
 * Authorization is enforced server-side by the `updatePhoto` resolver. We
 * additionally gate the form on the client to avoid a confusing experience
 * (e.g. flashing a form that will fail to submit) for users without
 * permission.
 *
 * NOTE: This first iteration intentionally does not expose the full set of
 * fields supported by `UpdatePhotoInput` (location coordinates, aircraft
 * cascade, photo categories, operator info, etc.). Those involve more
 * elaborate UI (map picker, cascading selects) that mirror the upload page,
 * and are deferred to a follow-up to keep this change focused and
 * reviewable. Editing those fields can still be performed via the API.
 */

type FormState = {
  caption: string;
  airline: string;
  airportCode: string;
  takenAt: string;
  tagsInput: string;
  gearBody: string;
  gearLens: string;
};

type FormField = keyof FormState;

const EMPTY_FORM: FormState = {
  caption: '',
  airline: '',
  airportCode: '',
  takenAt: '',
  tagsInput: '',
  gearBody: '',
  gearLens: '',
};

function buildInitialForm(photo: {
  caption?: string | null;
  airline?: string | null;
  airportCode?: string | null;
  takenAt?: string | null;
  tags?: string[] | null;
  gearBody?: string | null;
  gearLens?: string | null;
}): FormState {
  return {
    caption: photo.caption ?? '',
    airline: photo.airline ?? '',
    airportCode: photo.airportCode ?? '',
    // <input type="date"> requires YYYY-MM-DD format.
    takenAt: photo.takenAt ? new Date(photo.takenAt).toISOString().slice(0, 10) : '',
    tagsInput: Array.isArray(photo.tags) ? photo.tags.join(', ') : '',
    gearBody: photo.gearBody ?? '',
    gearLens: photo.gearLens ?? '',
  };
}

export default function EditPhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, ready } = useAuth();
  const router = useRouter();

  const [result] = useQuery({ query: GET_PHOTO, variables: { id } });
  const { data, fetching, error } = result;

  const [{ fetching: saving }, updatePhoto] = useMutation(UPDATE_PHOTO);

  // Single consolidated form state plus a sentinel for the photo id we last
  // hydrated from. React explicitly endorses calling setState during render
  // when guarded by a piece of state-tracked prop value; this avoids both
  // the `react-hooks/set-state-in-effect` and `react-hooks/refs` lint
  // rules. The next render will see the updated sentinel and skip the
  // setState calls, so this terminates after a single render cycle.
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lastHydratedPhotoId, setLastHydratedPhotoId] = useState<string | null>(null);

  // Track which fields the user has edited. We only send a field in the
  // mutation input when the user has actually touched it. This preserves
  // the API contract that `undefined` leaves a value alone while an
  // explicit value (including null/empty) overwrites it. In particular,
  // sending `tags: []` would clear all tags, so we must only send tags
  // when the user has actually edited the field.
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});

  const [formError, setFormError] = useState<string | null>(null);

  // Hydrate form from the loaded photo. The sentinel-in-state pattern means
  // this only fires once per distinct photo id.
  if (data?.photo && lastHydratedPhotoId !== data.photo.id) {
    setLastHydratedPhotoId(data.photo.id);
    setForm(buildInitialForm(data.photo));
    setTouched({});
  }

  const updateField = (field: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  if (fetching || !ready) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !data?.photo) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <p>Photo not found.</p>
        <Link href="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Back to feed
        </Link>
      </div>
    );
  }

  const photo = data.photo;
  const isOwner = user?.id === photo.user.id;
  const isPrivileged =
    user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'superuser';
  const canEdit = isOwner || isPrivileged;

  if (!canEdit) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <h1>Not allowed</h1>
        <p>You do not have permission to edit this photo.</p>
        <Link href={`/photos/${id}`} className="btn btn-secondary" style={{ marginTop: 16 }}>
          Back to photo
        </Link>
      </div>
    );
  }

  const parseTags = (raw: string): string[] =>
    raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.caption.length > 2000) {
      setFormError('Caption must be 2000 characters or fewer.');
      return;
    }

    const parsedTags = parseTags(form.tagsInput);
    if (parsedTags.length > 30) {
      setFormError('A photo can have at most 30 tags.');
      return;
    }

    // Only include fields the user actually edited. See note on `touched`
    // above for why this matters (especially for `tags`).
    const input: Record<string, unknown> = {};
    if (touched.caption) input.caption = form.caption.trim() === '' ? null : form.caption;
    if (touched.airline) input.airline = form.airline.trim() === '' ? null : form.airline.trim();
    if (touched.airportCode) {
      input.airportCode =
        form.airportCode.trim() === '' ? null : form.airportCode.trim().toUpperCase();
    }
    if (touched.takenAt) {
      input.takenAt = form.takenAt === '' ? null : new Date(form.takenAt).toISOString();
    }
    if (touched.tagsInput) input.tags = parsedTags;
    if (touched.gearBody)
      input.gearBody = form.gearBody.trim() === '' ? null : form.gearBody.trim();
    if (touched.gearLens)
      input.gearLens = form.gearLens.trim() === '' ? null : form.gearLens.trim();

    if (Object.keys(input).length === 0) {
      // Nothing changed — just navigate back.
      router.push(`/photos/${id}`);
      return;
    }

    const res = await updatePhoto({ id, input });
    if (res.error) {
      setFormError(res.error.graphQLErrors?.[0]?.message ?? 'Failed to update photo.');
      return;
    }
    router.push(`/photos/${id}`);
  };

  return (
    <div className="container" style={{ padding: '32px 0', maxWidth: 720 }}>
      <Link
        href={`/photos/${id}`}
        style={{ display: 'inline-block', marginBottom: 16, fontSize: '0.875rem' }}
      >
        ← Back to photo
      </Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Edit photo</h1>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          marginBottom: 24,
        }}
      >
        Update the metadata for this photo. Changes are saved when you click Save.
        {!isOwner && isPrivileged && (
          <>
            <br />
            <strong>You are editing this photo as a moderator.</strong>
          </>
        )}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="label" htmlFor="caption">
            Caption
          </label>
          <textarea
            id="caption"
            className="input"
            rows={4}
            value={form.caption}
            maxLength={2000}
            onChange={(e) => updateField('caption', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="airline">
            Airline
          </label>
          <input
            id="airline"
            className="input"
            type="text"
            value={form.airline}
            onChange={(e) => updateField('airline', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="airportCode">
            Airport code
          </label>
          <input
            id="airportCode"
            className="input"
            type="text"
            value={form.airportCode}
            placeholder="e.g. KJFK"
            onChange={(e) => updateField('airportCode', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="takenAt">
            Date taken
          </label>
          <input
            id="takenAt"
            className="input"
            type="date"
            value={form.takenAt}
            onChange={(e) => updateField('takenAt', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="tags">
            Tags
          </label>
          <input
            id="tags"
            className="input"
            type="text"
            value={form.tagsInput}
            placeholder="comma-separated, e.g. a380, sunset, takeoff"
            onChange={(e) => updateField('tagsInput', e.target.value)}
          />
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              marginTop: 4,
            }}
          >
            Up to 30 tags. Tags are lowercased automatically.
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="gearBody">
            Camera body
          </label>
          <input
            id="gearBody"
            className="input"
            type="text"
            value={form.gearBody}
            onChange={(e) => updateField('gearBody', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="gearLens">
            Lens
          </label>
          <input
            id="gearLens"
            className="input"
            type="text"
            value={form.gearLens}
            onChange={(e) => updateField('gearLens', e.target.value)}
          />
        </div>

        {formError && (
          <p className="error-text" role="alert">
            {formError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/photos/${id}`} className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
