'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CANCEL_RSVP,
  DELETE_COMMUNITY_EVENT,
  GET_COMMUNITY_EVENT,
  RSVP_EVENT,
  UPDATE_COMMUNITY_EVENT,
} from '@/lib/queries';

import styles from '../../forum/page.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── RSVP Section ────────────────────────────────────────────────────────────

function RsvpSection({
  event,
  onRsvp,
  onCancel,
}: {
  event: any;
  onRsvp: (status: string) => void;
  onCancel: () => void;
}) {
  const myStatus = event.myRsvp?.status;

  const btnStyle = (status: string) => ({
    fontWeight: myStatus === status ? 700 : 400,
    border: myStatus === status ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: myStatus === status ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'var(--color-bg-card)',
  });

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px',
        marginBottom: 24,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 4 }}>
        👥 {event.attendeeCount} going
        {event.maxAttendees && ` / ${event.maxAttendees} max`}
        {event.isFull && (
          <span
            style={{
              marginLeft: 8,
              background: '#f87171',
              color: '#fff',
              borderRadius: 4,
              padding: '1px 8px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            Full
          </span>
        )}
      </div>

      {myStatus && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', marginBottom: 12 }}>
          ✓ Your RSVP: <strong>{myStatus.replace('_', ' ')}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={btnStyle('going')}
          onClick={() => onRsvp('going')}
          disabled={event.isFull && myStatus !== 'going'}
        >
          ✈️ Going
        </button>
        <button
          className="btn btn-secondary"
          style={btnStyle('maybe')}
          onClick={() => onRsvp('maybe')}
        >
          🤔 Maybe
        </button>
        <button
          className="btn btn-secondary"
          style={btnStyle('not_going')}
          onClick={() => onRsvp('not_going')}
        >
          ✗ Can&apos;t Go
        </button>
        {myStatus && (
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={onCancel}
          >
            Cancel RSVP
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventForm({
  event,
  onSave,
  onCancel,
}: {
  event: any;
  onSave: (input: any) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [location, setLocation] = useState(event.location ?? '');
  const [startsAt, setStartsAt] = useState(toLocalDatetimeValue(event.startsAt));
  const [endsAt, setEndsAt] = useState(event.endsAt ? toLocalDatetimeValue(event.endsAt) : '');
  const [maxAttendees, setMaxAttendees] = useState(event.maxAttendees ? String(event.maxAttendees) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({
        title,
        description: description || null,
        location: location || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      });
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.newThreadForm}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Title</label>
        <input className={styles.input} type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Description</label>
        <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Location</label>
        <input className={styles.input} type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Starts At</label>
        <input className={styles.input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Ends At (optional)</label>
        <input className={styles.input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Max Attendees (optional)</label>
        <input className={styles.input} type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} min="1" placeholder="Unlimited" />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [rsvpError, setRsvpError] = useState('');

  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_COMMUNITY_EVENT,
    variables: { id: eventId },
    requestPolicy: 'cache-and-network',
  });

  const [, rsvpEvent] = useMutation(RSVP_EVENT);
  const [, cancelRsvp] = useMutation(CANCEL_RSVP);
  const [, updateEvent] = useMutation(UPDATE_COMMUNITY_EVENT);
  const [, deleteEvent] = useMutation(DELETE_COMMUNITY_EVENT);

  const event = data?.communityEvent;
  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  if (fetching && !data) return <div className={styles.loading}>Loading…</div>;
  if (!fetching && data && !event) return <div className={styles.empty}>Event not found.</div>;
  if (!event) return <div className={styles.loading}>Loading…</div>;

  // We don't have the membership role here without a separate query, so we
  // rely on error responses for access control. Show edit/delete for the
  // organizer or if the API allows it.
  const isOrganizer = user && event.organizer?.username === user.username;

  const handleRsvp = async (status: string) => {
    setRsvpError('');
    const result = await rsvpEvent({ eventId: event.id, status });
    if (result.error) {
      setRsvpError(result.error.graphQLErrors?.[0]?.message ?? result.error.message);
    } else {
      refresh();
    }
  };

  const handleCancelRsvp = async () => {
    await cancelRsvp({ eventId: event.id });
    refresh();
  };

  const handleSave = async (input: any) => {
    const result = await updateEvent({ id: event.id, input });
    if (result.error) {
      throw new Error(result.error.graphQLErrors?.[0]?.message ?? result.error.message);
    }
    setEditing(false);
    refresh();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    const result = await deleteEvent({ id: event.id });
    if (!result.error) {
      router.push(`/communities/${slug}/events`);
    }
  };

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/communities">Communities</Link>
        <span>/</span>
        <Link href={`/communities/${slug}`}>{slug}</Link>
        <span>/</span>
        <Link href={`/communities/${slug}/events`}>Events</Link>
        <span>/</span>
        <span>{event.title}</span>
      </div>

      {/* Event header */}
      <div className={styles.threadHeader}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📅</div>
        <h1 className={styles.threadTitle2}>{event.title}</h1>
        <div className={styles.threadHeaderMeta}>
          <span>
            by{' '}
            <Link href={`/u/${event.organizer.username}/photos`} style={{ color: 'var(--color-accent)' }}>
              {event.organizer.profile?.displayName || event.organizer.username}
            </Link>
          </span>
          <span>📅 {formatDate(event.startsAt)}</span>
          {event.endsAt && <span>→ {formatDate(event.endsAt)}</span>}
          {event.location && <span>📍 {event.location}</span>}
        </div>

        {/* Admin / organizer actions */}
        {user && isOrganizer && !editing && (
          <div className={styles.threadActions}>
            <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ fontSize: '0.8125rem' }}>
              Edit
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDelete}
              style={{ fontSize: '0.8125rem', color: '#f87171' }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <EditEventForm event={event} onSave={handleSave} onCancel={() => setEditing(false)} />
      )}

      {/* Description */}
      {event.description && !editing && (
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px',
            marginBottom: 24,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {event.description}
        </div>
      )}

      {/* RSVP section */}
      {user && !editing && (
        <>
          {rsvpError && <div className={styles.error} style={{ marginBottom: 12 }}>{rsvpError}</div>}
          <RsvpSection event={event} onRsvp={handleRsvp} onCancel={handleCancelRsvp} />
        </>
      )}

      {!user && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          <Link href="/signin" style={{ color: 'var(--color-accent)' }}>Sign in</Link> to RSVP for this event.
        </div>
      )}
    </div>
  );
}
