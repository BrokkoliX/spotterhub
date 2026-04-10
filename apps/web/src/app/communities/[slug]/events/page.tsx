'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  CREATE_COMMUNITY_EVENT,
  DELETE_COMMUNITY_EVENT,
  GET_COMMUNITY,
} from '@/lib/queries';
import type { GetCommunityEventsQuery } from '@/lib/generated/graphql';
import { useGetCommunityEventsQuery } from '@/lib/generated/graphql';

import styles from '../forum/page.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({
  communityId,
  onClose,
  onCreated,
}: {
  communityId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [, createEvent] = useMutation(CREATE_COMMUNITY_EVENT);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const result = await createEvent({
      communityId,
      input: {
        title,
        description: description || undefined,
        location: location || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
      },
    });

    setSaving(false);
    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message ?? result.error.message);
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className={styles.modal} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalCard}>
        <div className={styles.modalTitle}>Create Event</div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Title *</label>
            <input
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ minHeight: 80 }}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Location</label>
            <input
              className={styles.input}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Terminal 3 Roof, LLBG"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Starts At *</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Ends At (optional)</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Max Attendees (optional)</label>
            <input
              className={styles.input}
              type="number"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              min="1"
              placeholder="Unlimited"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [includePast, setIncludePast] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const community = communityData?.community;
  const myRole = community?.myMembership?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const [{ data, fetching }, reexecute] = useGetCommunityEventsQuery({
    variables: { communityId: community?.id ?? '', first: 50, includePast },
    pause: !community?.id,
    requestPolicy: 'cache-and-network',
  });

  const [, deleteEvent] = useMutation(DELETE_COMMUNITY_EVENT);

  const events: GetCommunityEventsQuery['communityEvents']['edges'][number]['node'][] = data?.communityEvents?.edges?.map((e) => e.node) ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await deleteEvent({ id });
    reexecute({ requestPolicy: 'network-only' });
  };

  const refresh = () => reexecute({ requestPolicy: 'network-only' });

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/communities">Communities</Link>
        <span>/</span>
        <Link href={`/communities/${slug}`}>{community?.name ?? slug}</Link>
        <span>/</span>
        <span>Events</span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📅 Events</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
            />
            Show past events
          </label>
          {user && isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create Event
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      {fetching && !data && <div className={styles.loading}>Loading…</div>}

      {!fetching && events.length === 0 && (
        <div className={styles.empty}>
          {includePast ? 'No events found.' : 'No upcoming events. Check back later!'}
        </div>
      )}

      <div className={styles.categoryList}>
        {events.map((event) => (
          <div
            key={event.id}
            className={styles.categoryCard}
            style={{ flexDirection: 'row', alignItems: 'flex-start' }}
          >
            <div className={styles.categoryIcon}>📅</div>
            <div className={styles.categoryBody}>
              <Link
                href={`/communities/${slug}/events/${event.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className={styles.categoryName}>{event.title}</div>
              </Link>
              <div className={styles.categoryDesc}>
                {formatDate(event.startsAt)}
                {event.endsAt && ` – ${formatDate(event.endsAt)}`}
              </div>
              <div className={styles.categoryMeta}>
                {event.location && <span>📍 {event.location}</span>}
                <span>
                  👥 {event.attendeeCount} going
                  {event.maxAttendees && ` / ${event.maxAttendees} max`}
                </span>
                {event.isFull && (
                  <span style={{ color: '#f87171', fontWeight: 600 }}>Full</span>
                )}
                {event.myRsvp && (
                  <span style={{ color: 'var(--color-accent)' }}>
                    ✓ You&apos;re {event.myRsvp.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link
                href={`/communities/${slug}/events/${event.id}`}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem' }}
              >
                View
              </Link>
              {user && isAdmin && (
                <button
                  className={styles.postAction}
                  onClick={() => handleDelete(event.id)}
                  style={{ color: '#f87171' }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && community && (
        <CreateEventModal
          communityId={community.id}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
