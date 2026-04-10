import { randomBytes } from 'node:crypto';

import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser } from '../utils/resolverHelpers.js';
import { createNotification } from './notificationResolvers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommunityParent {
  id: string;
  ownerId: string;
}

export interface CommunityMemberParent {
  id: string;
  communityId: string;
  userId: string;
}

export interface CreateCommunityInput {
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  visibility?: string | null;
  location?: string | null;
}

export interface UpdateCommunityInput {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  visibility?: string | null;
  location?: string | null;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const VALID_VISIBILITIES = ['public', 'invite_only'];
const COMMUNITY_ROLES = ['owner', 'admin', 'moderator', 'member'] as const;
type CommunityRoleType = (typeof COMMUNITY_ROLES)[number];

/** Numeric role weight — higher = more power. */
function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

/** Get the caller's membership in a community. Returns null if not a member. */
async function getMembership(ctx: Context, communityId: string, userId: string) {
  return ctx.prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
}

function generateInviteCodeString(): string {
  return randomBytes(6).toString('hex'); // 12 chars
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const communityQueryResolvers = {
  community: async (_parent: unknown, args: { slug: string }, ctx: Context) => {
    return ctx.prisma.community.findUnique({ where: { slug: args.slug } });
  },

  communities: async (
    _parent: unknown,
    args: { search?: string; category?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    const where: Record<string, unknown> = { visibility: 'public' };

    if (args.category) {
      where.category = args.category;
    }
    if (args.search) {
      where.OR = [
        { name: { contains: args.search, mode: 'insensitive' } },
        { description: { contains: args.search, mode: 'insensitive' } },
      ];
    }
    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.community.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
      }),
      ctx.prisma.community.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((c) => ({
      cursor: encodeCursor(c.createdAt),
      node: c,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  },

  myCommunities: async (_parent: unknown, _args: unknown, ctx: Context) => {
    const dbUser = await getDbUser(ctx);
    const memberships = await ctx.prisma.communityMember.findMany({
      where: { userId: dbUser.id, status: 'active' },
      include: { community: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => m.community);
  },
};

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const communityMutationResolvers = {
  createCommunity: async (
    _parent: unknown,
    args: { input: CreateCommunityInput },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const { name, slug, description, category, visibility, location } = args.input;

    // Validate name
    if (!name || name.trim().length < 3 || name.trim().length > 100) {
      throw new GraphQLError('Community name must be 3–100 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate slug
    if (!SLUG_RE.test(slug)) {
      throw new GraphQLError(
        'Slug must be 3–50 characters, lowercase alphanumeric and hyphens only, cannot start/end with a hyphen',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    // Check slug uniqueness
    const existing = await ctx.prisma.community.findUnique({ where: { slug } });
    if (existing) {
      throw new GraphQLError('A community with this slug already exists', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate visibility
    const vis = visibility ?? 'public';
    if (!VALID_VISIBILITIES.includes(vis)) {
      throw new GraphQLError(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Create community + owner membership in a transaction
    const community = await ctx.prisma.$transaction(async (tx) => {
      const comm = await tx.community.create({
        data: {
          name: name.trim(),
          slug,
          description: description?.trim() ?? null,
          category: category ?? null,
          visibility: vis as 'public' | 'invite_only',
          location: location?.trim() ?? null,
          ownerId: dbUser.id,
          inviteCode: vis === 'invite_only' ? generateInviteCodeString() : null,
        },
      });

      // Auto-add creator as owner member
      await tx.communityMember.create({
        data: {
          communityId: comm.id,
          userId: dbUser.id,
          role: 'owner',
          status: 'active',
        },
      });

      return comm;
    });

    return community;
  },

  updateCommunity: async (
    _parent: unknown,
    args: { id: string; input: UpdateCommunityInput },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const community = await ctx.prisma.community.findUnique({ where: { id: args.id } });
    if (!community) {
      throw new GraphQLError('Community not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Check permission: owner or admin
    const membership = await getMembership(ctx, args.id, dbUser.id);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new GraphQLError('Only community owners and admins can update community details', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const { slug, visibility, ...rest } = args.input;
    const data: Record<string, unknown> = {};

    // Copy non-null fields
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null) {
        data[key] = typeof value === 'string' ? value.trim() : value;
      }
    }

    // Validate slug change
    if (slug && slug !== community.slug) {
      if (!SLUG_RE.test(slug)) {
        throw new GraphQLError(
          'Slug must be 3–50 characters, lowercase alphanumeric and hyphens only',
          { extensions: { code: 'BAD_USER_INPUT' } },
        );
      }
      const existing = await ctx.prisma.community.findUnique({ where: { slug } });
      if (existing) {
        throw new GraphQLError('A community with this slug already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      data.slug = slug;
    }

    // Validate visibility change
    if (visibility && visibility !== community.visibility) {
      if (!VALID_VISIBILITIES.includes(visibility)) {
        throw new GraphQLError(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      data.visibility = visibility as 'public' | 'invite_only';
      // Auto-generate invite code when switching to invite_only
      if (visibility === 'invite_only' && !community.inviteCode) {
        data.inviteCode = generateInviteCodeString();
      }
    }

    return ctx.prisma.community.update({ where: { id: args.id }, data });
  },

  deleteCommunity: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const community = await ctx.prisma.community.findUnique({ where: { id: args.id } });
    if (!community) {
      throw new GraphQLError('Community not found', { extensions: { code: 'NOT_FOUND' } });
    }

    if (community.ownerId !== dbUser.id) {
      throw new GraphQLError('Only the community owner can delete a community', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.community.delete({ where: { id: args.id } });
    return true;
  },

  joinCommunity: async (
    _parent: unknown,
    args: { communityId: string; inviteCode?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const community = await ctx.prisma.community.findUnique({ where: { id: args.communityId } });
    if (!community) {
      throw new GraphQLError('Community not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Check for existing membership
    const existing = await getMembership(ctx, args.communityId, dbUser.id);
    if (existing) {
      if (existing.status === 'banned') {
        throw new GraphQLError('You have been banned from this community', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (existing.status === 'active') {
        throw new GraphQLError('You are already a member of this community', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    // Invite-only check
    if (community.visibility === 'invite_only') {
      if (!args.inviteCode || args.inviteCode !== community.inviteCode) {
        throw new GraphQLError('Invalid or missing invite code', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    // Create or update membership
    let member;
    if (existing) {
      member = await ctx.prisma.communityMember.update({
        where: { id: existing.id },
        data: { status: 'active', role: 'member' },
      });
    } else {
      member = await ctx.prisma.communityMember.create({
        data: {
          communityId: args.communityId,
          userId: dbUser.id,
          role: 'member',
          status: 'active',
        },
      });
    }

    // Notify the community owner (skip if joiner is the owner)
    if (community.ownerId !== dbUser.id) {
      const joiner = await ctx.prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { username: true },
      });
      if (joiner) {
        createNotification(ctx.prisma, {
          userId: community.ownerId,
          type: 'community_join',
          title: '🏘️ New member',
          body: `@${joiner.username} joined ${community.name}`,
          data: { communityId: args.communityId, userId: dbUser.id },
        }).catch(() => {});
      }
    }

    return member;
  },

  leaveCommunity: async (
    _parent: unknown,
    args: { communityId: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const membership = await getMembership(ctx, args.communityId, dbUser.id);
    if (!membership) {
      throw new GraphQLError('You are not a member of this community', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (membership.role === 'owner') {
      throw new GraphQLError(
        'Owners cannot leave their community. Transfer ownership or delete the community.',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }

    await ctx.prisma.communityMember.delete({ where: { id: membership.id } });
    return true;
  },

  removeCommunityMember: async (
    _parent: unknown,
    args: { communityId: string; userId: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    // Get caller's membership
    const callerMembership = await getMembership(ctx, args.communityId, dbUser.id);
    if (!callerMembership || !['owner', 'admin', 'moderator'].includes(callerMembership.role)) {
      throw new GraphQLError('You do not have permission to remove members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get target's membership
    const targetMembership = await getMembership(ctx, args.communityId, args.userId);
    if (!targetMembership) {
      throw new GraphQLError('User is not a member of this community', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Cannot remove someone with equal or higher role
    if (roleWeight(targetMembership.role) >= roleWeight(callerMembership.role)) {
      throw new GraphQLError('Cannot remove a member with equal or higher role', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.communityMember.delete({ where: { id: targetMembership.id } });
    return true;
  },

  updateCommunityMemberRole: async (
    _parent: unknown,
    args: { communityId: string; userId: string; role: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const newRole = args.role as CommunityRoleType;

    if (!COMMUNITY_ROLES.includes(newRole) || newRole === 'owner') {
      throw new GraphQLError(`Invalid role. Must be one of: admin, moderator, member`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Caller must be owner or admin
    const callerMembership = await getMembership(ctx, args.communityId, dbUser.id);
    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      throw new GraphQLError('Only owners and admins can change member roles', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Cannot promote above own role
    if (roleWeight(newRole) >= roleWeight(callerMembership.role)) {
      throw new GraphQLError('Cannot assign a role equal to or higher than your own', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const targetMembership = await getMembership(ctx, args.communityId, args.userId);
    if (!targetMembership) {
      throw new GraphQLError('User is not a member of this community', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Cannot change role of someone with equal or higher role
    if (roleWeight(targetMembership.role) >= roleWeight(callerMembership.role)) {
      throw new GraphQLError('Cannot change the role of a member with equal or higher role', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return ctx.prisma.communityMember.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
    });
  },

  generateInviteCode: async (
    _parent: unknown,
    args: { communityId: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const membership = await getMembership(ctx, args.communityId, dbUser.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new GraphQLError('Only owners and admins can manage invite codes', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return ctx.prisma.community.update({
      where: { id: args.communityId },
      data: { inviteCode: generateInviteCodeString() },
    });
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const communityFieldResolvers = {
  owner: (parent: CommunityParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.ownerId } });
  },

  memberCount: (parent: CommunityParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.communityMemberCount.load(parent.id);
  },

  myMembership: async (parent: CommunityParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!dbUser) return null;
    return ctx.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: parent.id, userId: dbUser.id } },
    });
  },

  members: async (
    parent: CommunityParent,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    const where: Record<string, unknown> = {
      communityId: parent.id,
      status: 'active',
    };

    if (args.after) {
      where.joinedAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.communityMember.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        take: take + 1,
      }),
      ctx.prisma.communityMember.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((m) => ({
      cursor: encodeCursor(m.joinedAt),
      node: m,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  },

  // Photos from community members
  photos: async (
    parent: CommunityParent,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    // Get all active member user IDs
    const memberUserIds = await ctx.prisma.communityMember.findMany({
      where: { communityId: parent.id, status: 'active' },
      select: { userId: true },
    });

    const userIds = memberUserIds.map((m) => m.userId);
    if (userIds.length === 0) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0,
      };
    }

    const where: Record<string, unknown> = {
      userId: { in: userIds },
      moderationStatus: { in: ['approved', 'pending'] },
    };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: { user: true, variants: true, tags: true },
      }),
      ctx.prisma.photo.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((p) => ({
      cursor: encodeCursor(p.createdAt),
      node: p,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  },

  // Community albums
  albums: async (
    parent: CommunityParent,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    const where: Record<string, unknown> = { communityId: parent.id };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.album.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: {
          user: { include: { profile: true } },
          coverPhoto: { include: { variants: true } },
        },
      }),
      ctx.prisma.album.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((album) => ({
      cursor: encodeCursor(album.createdAt),
      node: album,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  },

  // Hide invite code from non-admins
  inviteCode: async (parent: CommunityParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!dbUser) return null;
    const membership = await ctx.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: parent.id, userId: dbUser.id } },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) return null;
    // Fetch the actual invite code from DB since parent may not have it
    const community = await ctx.prisma.community.findUnique({
      where: { id: parent.id },
      select: { inviteCode: true },
    });
    return community?.inviteCode ?? null;
  },
};

export const communityMemberFieldResolvers = {
  user: (parent: CommunityMemberParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.userId } });
  },

  community: (parent: CommunityMemberParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.community.findUnique({ where: { id: parent.communityId } });
  },
};
