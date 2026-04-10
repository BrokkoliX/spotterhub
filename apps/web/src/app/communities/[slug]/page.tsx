'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import {
  BAN_COMMUNITY_MEMBER,
  CREATE_COMMUNITY_ALBUM,
  DELETE_COMMUNITY,
  GENERATE_INVITE_CODE,
  GET_COMMUNITY,
  GET_COMMUNITY_EVENTS,
  GET_COMMUNITY_MODERATION_LOGS,
  JOIN_COMMUNITY,
  LEAVE_COMMUNITY,
  REMOVE_COMMUNITY_MEMBER,
  UNBAN_COMMUNITY_MEMBER,
  UPDATE_COMMUNITY,
} from '@/lib/queries';

import styles from '../page.module.css';

// ─── Sub-components ─────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cls =
    {
      owner: styles.roleOwner,
      admin: styles.roleAdmin,
      moderator: styles.roleModerator,
      member: styles.roleMember,
    }[role] || styles.roleMember;

  return <span className={`${styles.roleBadge} ${cls}`}>{role}</span>;
}

type Tab = 'photos' | 'albums' | 'members' | 'moderation' | 'forum' | 'events' | 'settings';

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('photos');

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [, joinCommunity] = useMutation(JOIN_COMMUNITY);
  const [, leaveCommunity] = useMutation(LEAVE_COMMUNITY);
  const [, updateCommunity] = useMutation(UPDATE_COMMUNITY);
  const [, deleteCommunity] = useMutation(DELETE_COMMUNITY);
  const [, generateInvite] = useMutation(GENERATE_INVITE_CODE);
  const [, banMember] = useMutation(BAN_COMMUNITY_MEMBER);
  const [, unbanMember] = useMutation(UNBAN_COMMUNITY_MEMBER);
  const [, removeMember] = useMutation(REMOVE_COMMUNITY_MEMBER);
  const [, createCommunityAlbum] = useMutation(CREATE_COMMUNITY_ALBUM);

  const community = data?.community;

  if (fetching && !data) return <div className={styles.loading}>Loading…</div>;
  if (!fetching && data && !community) return <div className={styles.empty}>Community not found.</div>;
  if (!community) return <div className={styles.loading}>Loading…</div>;

  const myRole = community.myMembership?.role;
  const isMember = !!community.myMembership;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;

  const refresh = () => reexecuteQuery({ requestPolicy: 'network-only' });

  const handleJoin = async () => {
    await joinCommunity({ communityId: community.id });
    refresh();
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this community?')) return;
    await leaveCommunity({ communityId: community.id });
    refresh();
  };

  // Extract photos for PhotoGrid
  const photos = community.photos?.edges?.map((e: any) => e.node) ?? [];
  const photosHasNextPage = community.photos?.pageInfo?.hasNextPage ?? false;

  return (
    <div className={styles.communityPage}>
      {/* Banner */}
      <div className={styles.banner}>
        {community.bannerUrl ? (
          <img src={community.bannerUrl} alt="" className={styles.bannerImg} />
        ) : null}
      </div>

      {/* Info */}
      <div className={styles.communityInfo}>
        <div className={styles.communityAvatar}>
          {community.name.charAt(0).toUpperCase()}
        </div>

        <h1 className={styles.communityName}>{community.name}</h1>

        <div className={styles.communityMeta}>
          <span>
            👥 {community.memberCount} member
            {community.memberCount !== 1 ? 's' : ''}
          </span>
          {community.category && <span>📂 {community.category}</span>}
          {community.location && <span>📍 {community.location}</span>}
          <span>
            by{' '}
            <Link href={`/u/${community.owner.username}/photos`}>
              {community.owner.profile?.displayName || community.owner.username}
            </Link>
          </span>
          <span>
            {community.visibility === 'invite_only'
              ? '🔒 Invite Only'
              : '🌐 Public'}
          </span>
        </div>

        {community.description && (
          <p className={styles.communityDesc}>{community.description}</p>
        )}

        {/* Actions */}
        {ready && user && (
          <div className={styles.actions}>
            {isOwner && <RoleBadge role="owner" />}
            {isMember && !isOwner && <RoleBadge role={myRole!} />}
            {!isMember && (
              <button className="btn btn-primary" onClick={handleJoin}>
                Join Community
              </button>
            )}
            {isMember && !isOwner && (
              <button className="btn btn-secondary" onClick={handleLeave}>
                Leave Community
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'photos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          Photos
          <span className={styles.tabCount}>({community.photos?.totalCount ?? 0})</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'albums' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('albums')}
        >
          Albums
          <span className={styles.tabCount}>({community.albums?.totalCount ?? 0})</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
          <span className={styles.tabCount}>({community.members.totalCount})</span>
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === 'moderation' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('moderation')}
          >
            Moderation
          </button>
        )}
        <button
          className={`${styles.tab} ${activeTab === 'forum' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('forum')}
        >
          Forum
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'events' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'photos' && (
        <PhotosTab photos={photos} hasNextPage={photosHasNextPage} />
      )}
      {activeTab === 'albums' && (
        <AlbumsTab
          albums={community.albums}
          communityId={community.id}
          isAdmin={isAdmin}
          onCreated={refresh}
        />
      )}
      {activeTab === 'members' && (
        <MembersTab
          members={community.members.edges}
          totalCount={community.members.totalCount}
          communityId={community.id}
          isAdmin={isAdmin}
          myRole={myRole ?? 'member'}
        />
      )}
      {activeTab === 'moderation' && isAdmin && (
        <ModerationTab communityId={community.id} slug={slug} />
      )}
      {activeTab === 'forum' && (
        <ForumTab slug={slug} />
      )}
      {activeTab === 'events' && (
        <EventsTab slug={slug} communityId={community.id} isAdmin={isAdmin} />
      )}
      {activeTab === 'settings' && isAdmin && (
        <SettingsTab
          community={community}
          onUpdate={async (input: any) => {
            const result = await updateCommunity({ id: community.id, input });
            if (!result.error) refresh();
            return result;
          }}
          onDelete={async () => {
            if (
              !confirm(
                'Are you sure you want to permanently delete this community? This cannot be undone.',
              )
            )
              return;
            const result = await deleteCommunity({ id: community.id });
            if (!result.error) router.push('/communities');
          }}
          onGenerateInvite={async () => {
            await generateInvite({ communityId: community.id });
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Events Tab ─────────────────────────────────────────────────────────────

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

function EventsTab({
  slug,
  communityId,
  isAdmin,
}: {
  slug: string;
  communityId: string;
  isAdmin: boolean;
}) {
  const [{ data, fetching }] = useQuery({
    query: GET_COMMUNITY_EVENTS,
    variables: { communityId, first: 5 },
    requestPolicy: 'cache-and-network',
  });

  const events = data?.communityEvents?.edges?.map((e: any) => e.node) ?? [];

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>📅 Upcoming Events</div>
        <Link href={`/communities/${slug}/events`} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
          View All Events
        </Link>
      </div>

      {fetching && !data && <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</div>}

      {!fetching && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No upcoming events</div>
          {isAdmin && (
            <div style={{ fontSize: '0.875rem' }}>
              Create one from the{' '}
              <Link href={`/communities/${slug}/events`} style={{ color: 'var(--color-accent)' }}>
                events page
              </Link>.
            </div>
          )}
        </div>
      )}

      {events.map((event: any) => (
        <Link
          key={event.id}
          href={`/communities/${slug}/events/${event.id}`}
          style={{
            display: 'flex',
            gap: 16,
            padding: '14px 16px',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            color: 'inherit',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>📅</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 2 }}>{event.title}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {formatDate(event.startsAt)}
              {event.location && ` · ${event.location}`}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0, textAlign: 'right' }}>
            {event.attendeeCount} going
            {event.isFull && <span style={{ color: '#f87171', display: 'block' }}>Full</span>}
          </div>
        </Link>
      ))}

      {events.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Link href={`/communities/${slug}/events`} style={{ color: 'var(--color-accent)', fontSize: '0.875rem' }}>
            See all events →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Forum Tab ──────────────────────────────────────────────────────────────

function ForumTab({ slug }: { slug: string }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
      <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: 8 }}>Community Forum</div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
        Discuss topics, share tips, and connect with members.
      </div>
      <Link href={`/communities/${slug}/forum`} className="btn btn-primary">
        Open Forum
      </Link>
    </div>
  );
}

// ─── Albums Tab ─────────────────────────────────────────────────────────────

function AlbumsTab({
  albums,
  communityId,
  isAdmin,
  onCreated,
}: {
  albums: any;
  communityId: string;
  isAdmin: boolean;
  onCreated: () => void;
}) {
  const [, createAlbum] = useMutation(CREATE_COMMUNITY_ALBUM);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const albumEdges = albums?.edges ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const result = await createAlbum({
      communityId,
      input: { title: title.trim(), description: description.trim() || undefined },
    });
    setCreating(false);
    if (!result.error) {
      setShowCreate(false);
      setTitle('');
      setDescription('');
      onCreated();
    }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Albums ({albums?.totalCount ?? 0})</h2>
        {isAdmin && (
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.8125rem' }}
            onClick={() => setShowCreate(!showCreate)}
          >
            + Create Album
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 16,
            marginBottom: 20,
          }}
        >
          <input
            className={styles.input}
            type="text"
            placeholder="Album title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            style={{ marginBottom: 8, width: '100%' }}
          />
          <textarea
            className={styles.textarea}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginBottom: 8, width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {albumEdges.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
          No albums yet. {isAdmin ? 'Create one to get started.' : ''}
        </div>
      )}

      <div className={styles.albumGrid}>
        {albumEdges.map(({ node }: { node: any }) => (
          <Link
            key={node.id}
            href={`/albums/${node.id}`}
            className={styles.albumCard}
          >
            <div className={styles.albumCover}>
              {node.coverPhoto ? (
                <img
                  src={node.coverPhoto.variants?.find((v: any) => v.variantType === 'thumbnail')?.url ?? node.coverPhoto.variants?.[0]?.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '2rem' }}>📷</span>
              )}
            </div>
            <div className={styles.albumTitle}>{node.title}</div>
            <div className={styles.albumMeta}>{node.photoCount} photos</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Photos Tab ─────────────────────────────────────────────────────────────

function PhotosTab({
  photos,
  hasNextPage,
}: {
  photos: any[];
  hasNextPage: boolean;
}) {
  return (
    <PhotoGrid
      photos={photos}
      hasNextPage={hasNextPage}
      loading={false}
      onLoadMore={() => {}}
      emptyMessage="No photos from community members yet."
    />
  );
}

// ─── Members Tab ─────────────────────────────────────────────────────────────

function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'banned') {
    return <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 500 }}>banned</span>;
  }
  return null;
}

function MembersTab({
  members,
  totalCount,
  communityId,
  isAdmin,
  myRole,
}: {
  members: any[];
  totalCount: number;
  communityId: string;
  isAdmin: boolean;
  myRole: string;
}) {
  const [, banMember] = useMutation(BAN_COMMUNITY_MEMBER);
  const [, unbanMember] = useMutation(UNBAN_COMMUNITY_MEMBER);
  const [, removeMember] = useMutation(REMOVE_COMMUNITY_MEMBER);

  const myRoleWeight = roleWeight(myRole);

  const handleBan = async (userId: string) => {
    const reason = window.prompt('Reason for banning (optional):');
    await banMember({ communityId, userId, reason: reason || undefined });
  };

  const handleUnban = async (userId: string) => {
    if (!confirm('Unban this member so they can rejoin?')) return;
    await unbanMember({ communityId, userId });
  };

  const handleKick = async (userId: string) => {
    if (!confirm('Remove this member from the community?')) return;
    await removeMember({ communityId, userId });
  };

  return (
    <div className={styles.memberList}>
      <h2 className={styles.memberListTitle}>Members ({totalCount})</h2>
      {isAdmin && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Admins can ban or remove members. Owners and admins cannot be modified.
        </div>
      )}
      <div className={styles.memberGrid}>
        {members.map(({ node }: { node: any }) => {
          const targetWeight = roleWeight(node.role);
          const canModify = isAdmin && targetWeight < myRoleWeight;

          return (
            <div key={node.id} className={styles.memberCard}>
              <Link
                href={`/u/${node.user.username}/photos`}
                className={styles.memberInfo}
              >
                <div className={styles.memberAvatar}>
                  {node.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className={styles.memberName}>
                    {node.user.profile?.displayName || node.user.username}
                    <RoleBadge role={node.role} />
                    {node.status === 'banned' && <StatusBadge status="banned" />}
                  </div>
                </div>
              </Link>
              {canModify && (
                <div className={styles.memberActions}>
                  {node.status !== 'banned' ? (
                    <button
                      className={styles.actionBtn}
                      style={{ color: '#f87171' }}
                      onClick={() => handleBan(node.user.id)}
                    >
                      Ban
                    </button>
                  ) : (
                    <button
                      className={styles.actionBtn}
                      style={{ color: '#22c55e' }}
                      onClick={() => handleUnban(node.user.id)}
                    >
                      Unban
                    </button>
                  )}
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleKick(node.user.id)}
                  >
                    Kick
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Moderation Tab ──────────────────────────────────────────────────────────

function ModerationTab({ communityId, slug }: { communityId: string; slug: string }) {
  const [{ data, fetching }] = useQuery({
    query: GET_COMMUNITY_MODERATION_LOGS,
    variables: { communityId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  const logs = data?.communityModerationLogs?.edges?.map((e: any) => e.node) ?? [];

  const actionVerb: Record<string, string> = {
    ban: 'banned',
    unban: 'unbanned',
    kick: 'removed',
    pin_thread: 'pinned thread in',
    unpin_thread: 'unpinned thread in',
    lock_thread: 'locked thread in',
    unlock_thread: 'unlocked thread in',
    delete_post: 'deleted post in',
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <h2 className={styles.memberListTitle}>Moderation Log</h2>

      {fetching && !data && <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>}

      {!fetching && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
          No moderation actions have been taken yet.
        </div>
      )}

      {logs.map((log: any) => (
        <div key={log.id} className={styles.logEntry}>
          <div className={styles.logAction}>
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {actionVerb[log.action] || log.action}
            </span>
          </div>
          <div className={styles.logDetails}>
            <Link href={`/u/${log.moderator.username}/photos`} className={styles.logLink}>
              {log.moderator.profile?.displayName || log.moderator.username}
            </Link>
            {' → '}
            <Link href={`/u/${log.targetUser.username}/photos`} className={styles.logLink}>
              {log.targetUser.profile?.displayName || log.targetUser.username}
            </Link>
            {log.reason && (
              <span style={{ color: 'var(--color-text-muted)' }}> — {log.reason}</span>
            )}
          </div>
          <div className={styles.logTime}>
            {new Date(log.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Settings Tab ───────────────────────────────────────────────────────────

function SettingsTab({
  community,
  onUpdate,
  onDelete,
  onGenerateInvite,
}: {
  community: any;
  onUpdate: (input: any) => Promise<any>;
  onDelete: () => void;
  onGenerateInvite: () => void;
}) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? '');
  const [category, setCategory] = useState(community.category ?? 'general');
  const [visibility, setVisibility] = useState(community.visibility);
  const [location, setLocation] = useState(community.location ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const result = await onUpdate({
      name,
      description: description || null,
      category,
      visibility,
      location: location || null,
    });

    setSaving(false);
    if (result.error) {
      setError(
        result.error.graphQLErrors?.[0]?.message || result.error.message,
      );
    } else {
      setSuccess('Community updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleCopyInvite = () => {
    if (community.inviteCode) {
      navigator.clipboard.writeText(community.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.settingsPanel}>
      {/* Edit Details */}
      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>Community Details</h3>
        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={100}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <option value="public">Public</option>
              <option value="invite_only">Invite Only</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Location</label>
            <input
              className={styles.input}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Los Angeles, CA"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Invite Code */}
      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>Invite Code</h3>
        {community.inviteCode ? (
          <>
            <div className={styles.inviteBox}>
              <span className={styles.inviteCode}>{community.inviteCode}</span>
              <button className="btn btn-secondary" onClick={handleCopyInvite} type="button">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={onGenerateInvite}
                type="button"
              >
                Regenerate Code
              </button>
            </div>
          </>
        ) : (
          <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              No invite code yet. Generate one to allow invite-only access.
            </p>
            <button className="btn btn-secondary" onClick={onGenerateInvite} type="button">
              Generate Invite Code
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className={styles.settingsSection}>
        <div className={styles.dangerZone}>
          <div className={styles.dangerTitle}>Danger Zone</div>
          <p className={styles.dangerDesc}>
            Permanently delete this community and all its data. This action
            cannot be undone.
          </p>
          <button className={styles.btnDanger} onClick={onDelete} type="button">
            Delete Community
          </button>
        </div>
      </div>
    </div>
  );
}
