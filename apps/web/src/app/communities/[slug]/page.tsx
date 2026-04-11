'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMutation } from 'urql';

import { ImageUploader } from '@/components/ImageUploader';
import { useAuth, type User } from '@/lib/auth';
import {
  BAN_COMMUNITY_MEMBER,
  CREATE_COMMUNITY_ALBUM,
  DELETE_COMMUNITY,
  GENERATE_INVITE_CODE,
  GET_UPLOAD_URL,
  JOIN_COMMUNITY,
  LEAVE_COMMUNITY,
  REMOVE_COMMUNITY_MEMBER,
  UNBAN_COMMUNITY_MEMBER,
  UPDATE_COMMUNITY,
} from '@/lib/queries';
import type { CommunityQuery, UpdateCommunityInput } from '@/lib/generated/graphql';
import {
  useCommunityQuery,
  useGetCommunityEventsQuery,
  useCommunityModerationLogsQuery,
  useForumCategoriesQuery,
} from '@/lib/generated/graphql';

import styles from './page.module.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  };
}

// ─── Role Badge ─────────────────────────────────────────────────────────────

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
  const [bannerUploading, setBannerUploading] = useState(false);

  const [{ data, fetching }, reexecuteQuery] = useCommunityQuery({
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [, joinCommunity] = useMutation(JOIN_COMMUNITY);
  const [, leaveCommunity] = useMutation(LEAVE_COMMUNITY);
  const [, updateCommunity] = useMutation(UPDATE_COMMUNITY);
  const [, deleteCommunity] = useMutation(DELETE_COMMUNITY);
  const [, generateInvite] = useMutation(GENERATE_INVITE_CODE);
  const [, getUploadUrl] = useMutation(GET_UPLOAD_URL);

  const community = data?.community;

  if (fetching && !data) return <div className={styles.loading}>Loading…</div>;
  if (!fetching && data && !community) return <div className={styles.empty}>Community not found.</div>;
  if (!community) return <div className={styles.loading}>Loading…</div>;

  const myRole = community.myMembership?.role;
  const isMember = !!community.myMembership;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;
  const isSuperuser = user?.role === 'superuser';
  const canEdit = isAdmin || isSuperuser;

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

  const handleBannerFileSelect = async (file: File) => {
    setBannerUploading(true);
    try {
      const urlResult = await getUploadUrl({
        input: { mimeType: file.type, fileSizeBytes: file.size },
      });
      if (urlResult.error || !urlResult.data?.getUploadUrl) {
        alert(urlResult.error?.graphQLErrors?.[0]?.message || 'Failed to get upload URL');
        return;
      }
      const { url: presignedUrl, key } = urlResult.data.getUploadUrl;
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) {
        alert('Banner upload failed');
        return;
      }
      // Save the S3 object URL as the banner
      const S3_ENDPOINT = 'http://localhost:4566';
      const S3_BUCKET = 'spotterhub-photos';
      const bannerUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
      await updateCommunity({
        id: community.id,
        input: { bannerUrl, avatarUrl: community.avatarUrl ?? null },
      });
      refresh();
    } finally {
      setBannerUploading(false);
    }
  };

  return (
    <div>
      {/* Hero Banner */}
      <HeroSection
        community={community}
        isAdmin={canEdit}
        ready={ready}
        user={user}
        isMember={isMember}
        isOwner={isOwner}
        myRole={myRole}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onEditClick={() => setActiveTab('settings')}
        bannerUrl={community.bannerUrl}
        bannerUploading={bannerUploading}
        onBannerFileSelect={canEdit ? handleBannerFileSelect : undefined}
      />

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'photos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          Photos<span className={styles.tabCount}>({community.photos?.totalCount ?? 0})</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'albums' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('albums')}
        >
          Albums<span className={styles.tabCount}>({community.albums?.totalCount ?? 0})</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members<span className={styles.tabCount}>({community.members.totalCount})</span>
        </button>
        {canEdit && (
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
        {canEdit && (
          <button
            className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'photos' && (
          <MagazineLayout community={community} slug={slug} />
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
            members={community.members.edges.map((e) => e.node)}
            totalCount={community.members.totalCount}
            communityId={community.id}
            isAdmin={canEdit}
            myRole={myRole ?? 'member'}
          />
        )}
        {activeTab === 'moderation' && canEdit && (
          <ModerationTab communityId={community.id} />
        )}
        {activeTab === 'forum' && (
          <ForumTab slug={slug} />
        )}
        {activeTab === 'events' && (
          <EventsTab slug={slug} communityId={community.id} isAdmin={canEdit} />
        )}
        {activeTab === 'settings' && canEdit && (
          <SettingsTab
            community={community}
            onUpdate={async (input: UpdateCommunityInput) => {
              const result = await updateCommunity({ id: community.id, input });
              if (!result.error) refresh();
              return result;
            }}
            onBannerUpload={async (file: File) => {
              const urlResult = await getUploadUrl({
                input: { mimeType: file.type, fileSizeBytes: file.size },
              });
              if (urlResult.error || !urlResult.data?.getUploadUrl) {
                throw new Error(urlResult.error?.graphQLErrors?.[0]?.message || 'Failed to get upload URL');
              }
              const { url: presignedUrl, key } = urlResult.data.getUploadUrl;
              const uploadRes = await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
              });
              if (!uploadRes.ok) throw new Error('Upload failed');
              const S3_ENDPOINT = 'http://localhost:4566';
              const S3_BUCKET = 'spotterhub-photos';
              return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
            }}
            onAvatarUpload={async (file: File) => {
              const urlResult = await getUploadUrl({
                input: { mimeType: file.type, fileSizeBytes: file.size },
              });
              if (urlResult.error || !urlResult.data?.getUploadUrl) {
                throw new Error(urlResult.error?.graphQLErrors?.[0]?.message || 'Failed to get upload URL');
              }
              const { url: presignedUrl, key } = urlResult.data.getUploadUrl;
              const uploadRes = await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
              });
              if (!uploadRes.ok) throw new Error('Upload failed');
              const S3_ENDPOINT = 'http://localhost:4566';
              const S3_BUCKET = 'spotterhub-photos';
              return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
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
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({
  community,
  isAdmin,
  ready,
  user,
  isMember,
  isOwner,
  myRole,
  onJoin,
  onLeave,
  onEditClick,
  bannerUrl,
  bannerUploading,
  onBannerFileSelect,
}: {
  community: NonNullable<CommunityQuery['community']>;
  isAdmin: boolean;
  ready: boolean;
  user: User | null;
  isMember: boolean;
  isOwner: boolean;
  myRole: string | undefined;
  onJoin: () => void;
  onLeave: () => void;
  onEditClick: () => void;
  bannerUrl?: string | null;
  bannerUploading?: boolean;
  onBannerFileSelect?: (file: File) => void;
}) {
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleBannerClick = () => {
    if (isAdmin && !bannerUploading) {
      bannerInputRef.current?.click();
    }
  };

  return (
    <div className={styles.hero}>
      {bannerUrl ? (
        <div
          style={{ position: 'relative', cursor: isAdmin ? 'pointer' : 'default', height: '100%' }}
          onClick={handleBannerClick}
          title={isAdmin ? 'Click to change banner' : undefined}
        >
          <img src={bannerUrl} alt="" className={styles.heroBanner} />
          {isAdmin && !bannerUploading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.15s',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 500,
                gap: 8,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '0')}
            >
              📷 Change Banner
            </div>
          )}
          {bannerUploading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            >
              Uploading banner…
            </div>
          )}
        </div>
      ) : (
        <div
          className={styles.heroPlaceholder}
          style={{ cursor: isAdmin ? 'pointer' : 'default' }}
          onClick={handleBannerClick}
          title={isAdmin ? 'Click to add banner' : undefined}
        >
          {isAdmin ? '+ Add Banner' : '🛩️'}
        </div>
      )}
      <div className={styles.heroGradient} />

      <div className={styles.heroContent}>
        <div className={styles.heroTop}>
          <div className={styles.heroTitleRow}>
            <div className={styles.heroAvatar}>
              {community.avatarUrl ? (
                <img src={community.avatarUrl} alt="" />
              ) : (
                community.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className={styles.heroTitle}>{community.name}</h1>
              <div className={styles.heroMeta}>
                {community.location && <span>📍 {community.location}</span>}
                <span>👥 {community.memberCount} members</span>
                <span>{community.visibility === 'invite_only' ? '🔒 Invite Only' : '🌐 Public'}</span>
                {community.category && <span>📂 {community.category}</span>}
              </div>
            </div>
          </div>

          {isAdmin && (
            <button className={styles.heroEditBtn} onClick={onEditClick}>
              ✏️ Edit
            </button>
          )}
        </div>

        {community.description && (
          <p className={styles.heroDesc}>{community.description}</p>
        )}

        <div className={styles.heroActions}>
          {ready && user && (
            <>
              {isOwner && <RoleBadge role="owner" />}
              {isMember && !isOwner && <RoleBadge role={myRole!} />}
              {!isMember && (
                <button className="btn btn-primary" onClick={onJoin}>
                  Join Community
                </button>
              )}
              {isMember && !isOwner && (
                <button className="btn btn-secondary" onClick={onLeave}>
                  Leave
                </button>
              )}
            </>
          )}
          <Link href={`/u/${community.owner.username}/photos`} className="btn btn-secondary">
            by {community.owner.profile?.displayName || community.owner.username}
          </Link>
        </div>
      </div>

      {/* Hidden file input for inline banner upload */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onBannerFileSelect) {
            onBannerFileSelect(file);
          }
          if (e.target) e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Magazine Layout (Photos + Sidebar) ──────────────────────────────────────

function MagazineLayout({
  community,
  slug,
}: {
  community: NonNullable<CommunityQuery['community']>;
  slug: string;
}) {
  const photos = community.photos?.edges?.map((e) => e.node) ?? [];

  return (
    <div className={styles.contentGrid}>
      {/* Main Column: Photos + Forum */}
      <div className={styles.mainColumn}>
        {/* Photo Grid */}
        <div>
          <div className={styles.sectionTitle}>
            📷 Recent Photos
          </div>
          {photos.length > 0 ? (
            <div className={styles.photoGrid}>
              {photos.slice(0, 12).map((photo) => (
                <Link
                  key={photo.id}
                  href={`/photos/${photo.id}`}
                  className={styles.photoItem}
                >
                  <img
                    src={
                      photo.variants?.find((v) => v.variantType === 'thumbnail')?.url ??
                      photo.variants?.[0]?.url ??
                      ''
                    }
                    alt=""
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty} style={{ padding: '32px 0' }}>
              No photos yet.
            </div>
          )}
        </div>

        {/* Forum Activity */}
        <ForumActivity community={community} slug={slug} />
      </div>

      {/* Sidebar Column */}
      <div className={styles.sidebarColumn}>
        {/* Quick Stats */}
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionHeader}>📊 Stats</div>
          <div className={styles.statsGrid}>
            <div className={styles.statCell}>
              <div className={styles.statValue}>{community.photos?.totalCount ?? 0}</div>
              <div className={styles.statLabel}>Photos</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statValue}>{community.albums?.totalCount ?? 0}</div>
              <div className={styles.statLabel}>Albums</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statValue}>{community.members.totalCount}</div>
              <div className={styles.statLabel}>Members</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statValue}>💬</div>
              <div className={styles.statLabel}>Forum</div>
            </div>
          </div>
        </div>

        {/* Members Preview */}
        <MembersPreview community={community} />

        {/* Events Preview */}
        <EventsPreview slug={slug} communityId={community.id} />
      </div>
    </div>
  );
}

// ─── Forum Activity ──────────────────────────────────────────────────────────

function ForumActivity({
  community,
  slug,
}: {
  community: NonNullable<CommunityQuery['community']>;
  slug: string;
}) {
  const [{ data: forumData }] = useForumCategoriesQuery({
    variables: { communityId: community.id },
    pause: !community.id,
  });

  const categories = forumData?.forumCategories ?? [];
  const recentThreads = categories
    .flatMap((c) =>
      c.latestThread
        ? [{ ...c.latestThread, categorySlug: c.slug, categoryName: c.name }]
        : [],
    )
    .sort(
      (a, b) =>
        new Date(b.lastPostAt).getTime() - new Date(a.lastPostAt).getTime(),
    )
    .slice(0, 6);

  return (
    <div>
      <div className={styles.sectionTitle}>
        💬 Forum Activity
        <Link href={`/communities/${slug}/forum`} className={styles.sectionTitleLink}>
          Open Forum →
        </Link>
      </div>
      {recentThreads.length > 0 ? (
        <div className={styles.forumList}>
          {recentThreads.map((thread) => (
            <Link
              key={thread.id}
              href={`/communities/${slug}/forum/${thread.categorySlug}`}
              className={styles.forumCard}
            >
              <div className={styles.forumIcon}>💬</div>
              <div className={styles.forumBody}>
                <div className={styles.forumTitle}>{thread.title}</div>
                <div className={styles.forumMeta}>
                  by {thread.author.username} · {formatRelativeTime(thread.lastPostAt)}
                </div>
              </div>
              <div className={styles.forumCategory}>{thread.categoryName}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.empty} style={{ padding: '24px 0' }}>
          No forum posts yet.{' '}
          <Link href={`/communities/${slug}/forum`} style={{ color: 'var(--color-accent)' }}>
            Start a discussion
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Members Preview (Sidebar) ───────────────────────────────────────────────

function MembersPreview({ community }: { community: NonNullable<CommunityQuery['community']> }) {
  const members = community.members.edges.slice(0, 6).map((e) => e.node);

  return (
    <div className={styles.sidebarSection}>
      <div className={styles.sidebarSectionHeader}>👥 Members</div>
      <div className={styles.sidebarSectionBody}>
        {members.length > 0 ? (
          <>
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/u/${member.user.username}/photos`}
                className={styles.memberRow}
              >
                <div className={styles.memberAvatar}>
                  {member.user.profile?.avatarUrl ? (
                    <img src={member.user.profile.avatarUrl} alt="" />
                  ) : (
                    member.user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className={styles.memberName}>
                  {member.user.profile?.displayName || member.user.username}
                </div>
                <div className={styles.memberRole}>{member.role}</div>
              </Link>
            ))}
            {community.members.totalCount > 6 && (
              <Link
                href="#"
                className={styles.sectionTitleLink}
                style={{ display: 'block', textAlign: 'center', marginTop: 8 }}
              >
                View all {community.members.totalCount} members →
              </Link>
            )}
          </>
        ) : (
          <div className={styles.empty} style={{ padding: '16px 0' }}>No members yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── Events Preview (Sidebar) ────────────────────────────────────────────────

function EventsPreview({
  slug,
  communityId,
}: {
  slug: string;
  communityId: string;
}) {
  const [{ data }] = useGetCommunityEventsQuery({
    variables: { communityId, first: 3 },
    requestPolicy: 'cache-and-network',
  });

  const events = data?.communityEvents?.edges?.map((e) => e.node) ?? [];

  return (
    <div className={styles.sidebarSection}>
      <div className={styles.sidebarSectionHeader}>📅 Events</div>
      <div className={styles.sidebarSectionBody}>
        {events.length > 0 ? (
          <>
            {events.map((event) => {
              const { month, day } = formatEventDate(event.startsAt);
              return (
                <Link
                  key={event.id}
                  href={`/communities/${slug}/events/${event.id}`}
                  className={styles.eventRow}
                >
                  <div className={styles.eventDate}>
                    <span className={styles.eventDateMonth}>{month}</span>
                    <span className={styles.eventDateDay}>{day}</span>
                  </div>
                  <div className={styles.eventBody}>
                    <div className={styles.eventTitle}>{event.title}</div>
                    <div className={styles.eventMeta}>
                      {event.attendeeCount} going{event.isFull && ' · Full'}
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link
              href={`/communities/${slug}/events`}
              className={styles.sectionTitleLink}
              style={{ display: 'block', textAlign: 'center', marginTop: 8 }}
            >
              All events →
            </Link>
          </>
        ) : (
          <div style={{ padding: '8px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            No upcoming events.
          </div>
        )}
      </div>
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
  const [{ data, fetching }] = useGetCommunityEventsQuery({
    variables: { communityId, first: 5 },
    requestPolicy: 'cache-and-network',
  });

  const events = data?.communityEvents?.edges?.map((e) => e.node) ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>📅 Upcoming Events</div>
        <Link href={`/communities/${slug}/events`} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
          View All Events
        </Link>
      </div>

      {fetching && !data && (
        <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</div>
      )}

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

      {events.map((event) => (
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
    </div>
  );
}

// ─── Forum Tab ───────────────────────────────────────────────────────────────

function ForumTab({ slug }: { slug: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💬</div>
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
  albums: NonNullable<NonNullable<CommunityQuery['community']>['albums']>;
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
    <div>
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
        {albumEdges.map(({ node }) => (
          <Link
            key={node.id}
            href={`/albums/${node.id}`}
            className={styles.albumCard}
          >
            <div className={styles.albumCover}>
              {node.coverPhoto ? (
                <img
                  src={
                    node.coverPhoto.variants?.find((v) => v.variantType === 'thumbnail')?.url ??
                    node.coverPhoto.variants?.[0]?.url
                  }
                  alt=""
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

// ─── Members Tab ─────────────────────────────────────────────────────────────

function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

function MembersTab({
  members,
  totalCount,
  communityId,
  isAdmin,
  myRole,
}: {
  members: NonNullable<NonNullable<CommunityQuery['community']>['members']>['edges'][number]['node'][];
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
        {members.map((member) => {
          const targetWeight = roleWeight(member.role);
          const canModify = isAdmin && targetWeight < myRoleWeight;

          return (
            <div key={member.id} className={styles.memberCard}>
              <Link
                href={`/u/${member.user.username}/photos`}
                className={styles.memberInfo}
              >
                <div className={styles.memberAvatarLarge}>
                  {member.user.profile?.avatarUrl ? (
                    <img src={member.user.profile.avatarUrl} alt="" />
                  ) : (
                    member.user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className={styles.memberNameLabel}>
                  {member.user.profile?.displayName || member.user.username}
                  <RoleBadge role={member.role} />
                  {member.status === 'banned' && (
                    <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 500 }}>banned</span>
                  )}
                </div>
              </Link>
              {canModify && (
                <div className={styles.memberActions}>
                  {member.status !== 'banned' ? (
                    <button
                      className={styles.actionBtn}
                      style={{ color: '#f87171' }}
                      onClick={() => handleBan(member.user.id)}
                    >
                      Ban
                    </button>
                  ) : (
                    <button
                      className={styles.actionBtn}
                      style={{ color: '#22c55e' }}
                      onClick={() => handleUnban(member.user.id)}
                    >
                      Unban
                    </button>
                  )}
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleKick(member.user.id)}
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

// ─── Moderation Tab ─────────────────────────────────────────────────────────

function ModerationTab({ communityId }: { communityId: string }) {
  const [{ data, fetching }] = useCommunityModerationLogsQuery({
    variables: { communityId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  const logs = data?.communityModerationLogs?.edges?.map((e) => e.node) ?? [];

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
    <div>
      <h2 className={styles.memberListTitle}>Moderation Log</h2>

      {fetching && !data && <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>}

      {!fetching && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
          No moderation actions have been taken yet.
        </div>
      )}

      {logs.map((log) => (
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
  onBannerUpload,
  onAvatarUpload,
}: {
  community: NonNullable<CommunityQuery['community']>;
  onUpdate: (input: UpdateCommunityInput) => Promise<unknown>;
  onDelete: () => void;
  onGenerateInvite: () => void;
  onBannerUpload: (file: File) => Promise<string>;
  onAvatarUpload: (file: File) => Promise<string>;
}) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? '');
  const [category, setCategory] = useState(community.category ?? 'general');
  const [visibility, setVisibility] = useState(community.visibility);
  const [location, setLocation] = useState(community.location ?? '');
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? '');
  const [avatarUrl, setAvatarUrl] = useState(community.avatarUrl ?? '');
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
      bannerUrl: bannerUrl || null,
      avatarUrl: avatarUrl || null,
    });

    setSaving(false);
    const err = result as { error?: { message: string; graphQLErrors?: Array<{ message: string }> } };
    if (err.error) {
      setError(err.error.graphQLErrors?.[0]?.message || err.error.message);
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
      {/* Image Uploads */}
      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>Community Images</h3>
        <div className={styles.imageUploadRow}>
          <div className={styles.imageUploadItem}>
            <label className={styles.label}>Banner Image</label>
            <ImageUploader
              currentUrl={bannerUrl}
              aspectRatio="16/6"
              onUpload={async (file) => {
                const url = await onBannerUpload(file);
                setBannerUrl(url);
                return url;
              }}
              onUrl={(url) => setBannerUrl(url)}
              uploadLabel="Change"
            />
          </div>
          <div className={styles.imageUploadItem}>
            <label className={styles.label}>Avatar</label>
            <ImageUploader
              currentUrl={avatarUrl}
              aspectRatio="1/1"
              onUpload={async (file) => {
                const url = await onAvatarUpload(file);
                setAvatarUrl(url);
                return url;
              }}
              onUrl={(url) => setAvatarUrl(url)}
              uploadLabel="Change"
            />
          </div>
        </div>
      </div>

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
            Permanently delete this community and all its data. This action cannot be undone.
          </p>
          <button className={styles.btnDanger} onClick={onDelete} type="button">
            Delete Community
          </button>
        </div>
      </div>
    </div>
  );
}
