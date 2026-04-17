'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import {
  BAN_COMMUNITY_MEMBER,
  GET_COMMUNITY_MEMBERS,
  GENERATE_INVITE_CODE,
  REMOVE_COMMUNITY_MEMBER,
  TRANSFER_COMMUNITY_OWNERSHIP,
  UNBAN_COMMUNITY_MEMBER,
  UPDATE_COMMUNITY,
  UPDATE_COMMUNITY_MEMBER_ROLE,
} from '@/lib/queries';
import {
  useCommunityQuery,
  useCommunityModerationLogsQuery,
  type CommunityMember,
  type CommunityModerationLogsQuery,
} from '@/lib/generated/graphql';

type ModerationLogNode = CommunityModerationLogsQuery['communityModerationLogs']['edges'][number]['node'];

import styles from './page.module.css';

// ─── Types ─────────────────────────────────────────────────────────────────

type SubTab = 'overview' | 'members' | 'roles' | 'moderation';
type MemberStatus = 'active' | 'banned';
type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';

interface MemberFilter {
  search?: string;
  role?: MemberRole[];
  status?: MemberStatus[];
  first?: number;
  after?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommunityAdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [memberStatusFilter, setMemberStatusFilter] = useState<MemberStatus>('active');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<MemberRole | ''>('');
  const [memberCursor, setMemberCursor] = useState<string | undefined>(undefined);
  const [loadMoreKey, setLoadMoreKey] = useState(0);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Community data
  const [{ data: communityData, fetching: communityFetching }] = useCommunityQuery({
    variables: { slug },
    requestPolicy: 'network-only',
  });
  const community = communityData?.community;
  const myMembership = community?.myMembership;
  const myRole = myMembership?.role;
  const canAdmin = myRole === 'owner' || myRole === 'admin' || user?.role === 'superuser';

  // Member list query
  const [memberResult, refetchMembers] = useQuery({
    query: GET_COMMUNITY_MEMBERS,
    variables: {
      communityId: community?.id,
      filter: {
        search: memberSearch || undefined,
        role: memberRoleFilter ? [memberRoleFilter] : undefined,
        status: [memberStatusFilter],
        first: 20,
        after: memberCursor,
      } as MemberFilter,
    },
    pause: !community?.id,
    requestPolicy: 'network-only',
  });

  const members = memberResult.data?.communityMembers?.edges?.map((e: { node: CommunityMember }) => e.node) ?? [];
  const membersHasNext = memberResult.data?.communityMembers?.pageInfo?.hasNextPage;
  const membersTotal = memberResult.data?.communityMembers?.totalCount ?? 0;

  // Moderation logs
  const [{ data: modData, fetching: modFetching }] = useCommunityModerationLogsQuery({
    variables: { communityId: community?.id ?? '', first: 50 },
    pause: !community?.id,
    requestPolicy: 'network-only',
  });
  const modLogs = modData?.communityModerationLogs?.edges?.map((e: { node: ModerationLogNode }) => e.node) ?? [];

  // Mutations
  const [, banMember] = useMutation(BAN_COMMUNITY_MEMBER);
  const [, unbanMember] = useMutation(UNBAN_COMMUNITY_MEMBER);
  const [, kickMember] = useMutation(REMOVE_COMMUNITY_MEMBER);
  const [, updateRole] = useMutation(UPDATE_COMMUNITY_MEMBER_ROLE);
  const [, transferOwnership] = useMutation(TRANSFER_COMMUNITY_OWNERSHIP);
  const [, generateInvite] = useMutation(GENERATE_INVITE_CODE);
  const [, updateCommunity] = useMutation(UPDATE_COMMUNITY);

  if (communityFetching || !community) {
    return <div className={styles.page}>Loading…</div>;
  }

  if (!canAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>You do not have permission to access community admin.</p>
          <Link href={`/communities/${slug}`} className="btn btn-secondary" style={{ marginTop: 12 }}>
            Back to community
          </Link>
        </div>
      </div>
    );
  }

  const refreshMembers = () => {
    setMemberCursor(undefined);
    setLoadMoreKey((k) => k + 1);
    refetchMembers({ requestPolicy: 'network-only' });
  };

  const handleBan = async (userId: string) => {
    const reason = window.prompt('Reason for banning (optional):');
    await banMember({ communityId: community.id, userId, reason: reason || undefined });
    refreshMembers();
  };

  const handleUnban = async (userId: string) => {
    await unbanMember({ communityId: community.id, userId });
    refreshMembers();
  };

  const handleKick = async (userId: string) => {
    if (!confirm('Remove this member from the community?')) return;
    await kickMember({ communityId: community.id, userId });
    refreshMembers();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const result = await updateRole({ communityId: community.id, userId, role: newRole });
    if (result.error) {
      alert(result.error.graphQLErrors?.[0]?.message || 'Failed to update role');
    } else {
      refreshMembers();
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setTransferLoading(true);
    const result = await transferOwnership({ communityId: community.id, userId: transferTarget });
    setTransferLoading(false);
    if (result.error) {
      alert(result.error.graphQLErrors?.[0]?.message || 'Failed to transfer ownership');
    } else {
      setTransferTarget(null);
      router.refresh();
    }
  };

  const handleGenerateInvite = async () => {
    await generateInvite({ communityId: community.id });
  };

  const actionVerb: Record<string, string> = {
    ban: 'banned', unban: 'unbanned', kick: 'removed',
    pin_thread: 'pinned', unpin_thread: 'unpinned',
    lock_thread: 'locked', unlock_thread: 'unlocked',
    delete_post: 'deleted post', delete_photo: 'deleted photo', delete_comment: 'deleted comment',
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <Link href={`/communities/${slug}`} className={styles.backBtn}>
          ← Community
        </Link>
        <h1 className={styles.pageTitle}>Admin: {community.name}</h1>
      </div>

      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        {(['overview', 'members', 'roles', 'moderation'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeTab === tab ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{community.memberCount}</div>
              <div className={styles.statLabel}>Members</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{community.photos?.totalCount ?? 0}</div>
              <div className={styles.statLabel}>Photos</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{community.albums?.totalCount ?? 0}</div>
              <div className={styles.statLabel}>Albums</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{modLogs.length}</div>
              <div className={styles.statLabel}>Mod Actions</div>
            </div>
          </div>

          <div className={styles.quickActions}>
            <div className={styles.quickActionCard}>
              <div className={styles.quickActionTitle}>Transfer Ownership</div>
              <div className={styles.quickActionDesc}>Promote a member to owner. You become admin.</div>
              <button className="btn btn-secondary" onClick={() => setTransferTarget('prompt')}>
                Transfer Ownership
              </button>
            </div>
            <div className={styles.quickActionCard}>
              <div className={styles.quickActionTitle}>Invite Code</div>
              <div className={styles.quickActionDesc}>
                {community.visibility === 'invite_only'
                  ? `Current: ${community.inviteCode ?? 'None'}`
                  : 'Set to Invite Only to enable'}
              </div>
              <button className="btn btn-secondary" onClick={handleGenerateInvite}>
                Regenerate Code
              </button>
            </div>
            <div className={styles.quickActionCard}>
              <div className={styles.quickActionTitle}>Community Settings</div>
              <div className={styles.quickActionDesc}>Edit name, banner, description and more.</div>
              <Link href={`/communities/${slug}`} className="btn btn-secondary">
                Open Community
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {activeTab === 'members' && (
        <div>
          {/* Status sub-tabs */}
          <div className={styles.subTabs} style={{ marginBottom: 12 }}>
            {(['active', 'banned'] as MemberStatus[]).map((s) => (
              <button
                key={s}
                className={`${styles.subTab} ${memberStatusFilter === s ? styles.subTabActive : ''}`}
                onClick={() => { setMemberStatusFilter(s); setMemberCursor(undefined); }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: '0.75rem' }}>
                  ({s === 'active' ? community.memberCount : '—'})
                </span>
              </button>
            ))}
          </div>

          {/* Search + filter toolbar */}
          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or username…"
              value={memberSearch}
              onChange={(e) => { setMemberSearch(e.target.value); setMemberCursor(undefined); }}
            />
            <select
              className={styles.filterSelect}
              value={memberRoleFilter}
              onChange={(e) => { setMemberRoleFilter(e.target.value as MemberRole | ''); setMemberCursor(undefined); }}
            >
              <option value="">All roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="member">Member</option>
            </select>
          </div>

          {memberResult.fetching && members.length === 0 && (
            <div className={styles.emptyState}>Loading…</div>
          )}

          {!memberResult.fetching && members.length === 0 && (
            <div className={styles.emptyState}>
              No {memberStatusFilter} members found.
            </div>
          )}

          <div>
            {members.map((member: CommunityMember) => (
              <MemberRow
                key={member.id}
                member={member}
                canAdmin={canAdmin}
                myRole={myRole ?? 'member'}
                statusFilter={memberStatusFilter}
                communityId={community.id}
                onBan={handleBan}
                onUnban={handleUnban}
                onKick={handleKick}
                onRoleChange={handleRoleChange}
              />
            ))}
          </div>

          {membersHasNext && (
            <button
              className={styles.loadMore}
              onClick={() => {
                const last = memberResult.data?.communityMembers?.edges?.slice(-1)[0];
                if (last) {
                  setMemberCursor(last.cursor);
                }
              }}
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* ── Roles ── */}
      {activeTab === 'roles' && (
        <div>
          <div className={styles.rolesSummary}>
            {(['owner', 'admin', 'moderator', 'member'] as MemberRole[]).map((role) => {
              const count = members.filter((m: CommunityMember) => m.role === role).length;
              return (
                <div key={role} className={styles.roleSummaryCard}>
                  <div className={styles.roleSummaryCount}>{count}</div>
                  <div className={styles.roleSummaryLabel}>{role}</div>
                </div>
              );
            })}
          </div>

          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name or username…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
          </div>

          <div>
            {members.map((member: CommunityMember) => (
              <MemberRow
                key={member.id}
                member={member}
                canAdmin={canAdmin}
                myRole={myRole ?? 'member'}
                statusFilter="active"
                communityId={community.id}
                onBan={handleBan}
                onUnban={handleUnban}
                onKick={handleKick}
                onRoleChange={handleRoleChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Moderation ── */}
      {activeTab === 'moderation' && (
        <div>
          {modFetching && <div className={styles.emptyState}>Loading…</div>}
          {!modFetching && modLogs.length === 0 && (
            <div className={styles.emptyState}>No moderation actions yet.</div>
          )}
          {modLogs.map((log: ModerationLogNode) => (
            <div key={log.id} className={styles.modLogEntry}>
              <div className={styles.modLogAction}>
                {actionVerb[log.action] || log.action}
              </div>
              <div className={styles.modLogDetails}>
                by{' '}
                <Link href={`/u/${log.moderator.username}/photos`}>
                  {log.moderator.profile?.displayName || log.moderator.username}
                </Link>
                {' → '}
                <Link href={`/u/${log.targetUser.username}/photos`}>
                  {log.targetUser.profile?.displayName || log.targetUser.username}
                </Link>
                {log.reason && <span style={{ color: 'var(--color-text-muted)' }}> — {log.reason}</span>}
              </div>
              <div className={styles.modLogTime}>{formatDate(log.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {transferTarget === 'prompt' && (
        <div className={styles.transferModal}>
          <div className={styles.transferCard}>
            <div className={styles.transferTitle}>Transfer Ownership</div>
            <div className={styles.transferDesc}>
              Select a member to become the new owner. You will become an admin and can be demoted further.
              This cannot be undone easily.
            </div>
            <select
              className={styles.filterSelect}
              style={{ width: '100%', marginBottom: 8 }}
              onChange={(e) => setTransferTarget(e.target.value || null)}
              defaultValue=""
            >
              <option value="" disabled>Select a member…</option>
              {members
                .filter((m: CommunityMember) => m.user.id !== user?.id && m.status === 'active')
                .map((m: CommunityMember) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.profile?.displayName || m.user.username}
                  </option>
                ))}
            </select>
            <div className={styles.transferActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setTransferTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!transferTarget || transferLoading}
                onClick={handleTransfer}
              >
                {transferLoading ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Member Row ─────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canAdmin,
  myRole,
  statusFilter,
  communityId,
  onBan,
  onUnban,
  onKick,
  onRoleChange,
}: {
  member: CommunityMember;
  canAdmin: boolean;
  myRole: string;
  statusFilter: MemberStatus;
  communityId: string;
  onBan: (id: string) => void;
  onUnban: (id: string) => void;
  onKick: (id: string) => void;
  onRoleChange: (userId: string, role: string) => void;
}) {
  const targetWeight = roleWeight(member.role);
  const myRoleWeight = roleWeight(myRole);
  const canModify = canAdmin && targetWeight < myRoleWeight;
  const displayName = member.user.profile?.displayName || member.user.username;

  return (
    <div className={styles.memberRow}>
      <Link href={`/u/${member.user.username}/photos`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={styles.memberAvatar}>
            {member.user.profile?.avatarUrl ? (
              <img src={member.user.profile.avatarUrl} alt="" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className={styles.memberName}>{displayName}</div>
            <div className={styles.memberUsername}>@{member.user.username}</div>
          </div>
        </div>
      </Link>

      <div className={styles.memberBadges}>
        <span className={`${styles.roleBadge} ${styles[`role${capitalize(member.role)}`]}`}>
          {member.role}
        </span>
        {member.status !== 'active' && (
          <span className={`${styles.statusBadge} ${styles[`status${capitalize(member.status)}`]}`}>
            {member.status}
          </span>
        )}
      </div>

      <div className={styles.memberMeta} style={{ minWidth: 80 }}>
        {formatDate(member.joinedAt)}
      </div>

      {canModify && (
        <div className={styles.memberActions}>
          {member.role !== 'owner' && (
            <select
              className={styles.roleSelect}
              value={member.role}
              onChange={(e) => onRoleChange(member.user.id, e.target.value)}
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {statusFilter === 'active' ? (
            member.role !== 'owner' && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => onBan(member.user.id)}
              >
                Ban
              </button>
            )
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
              onClick={() => onUnban(member.user.id)}
            >
              Unban
            </button>
          )}
          {member.role !== 'owner' && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => onKick(member.user.id)}
            >
              Kick
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}