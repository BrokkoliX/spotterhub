import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, buildPaginationArgs } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserParent {
  id: string;
  cognitoSub?: string;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const userQueryResolvers = {
  health: async (_parent: unknown, _args: unknown, ctx: Context) => {
    let dbConnected = false;
    try {
      await ctx.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      // DB unreachable
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbConnected,
    };
  },

  me: async (_parent: unknown, _args: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    return ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      include: { profile: true, sellerProfile: true },
    });
  },

  user: async (_parent: unknown, args: { username: string }, ctx: Context) => {
    const user = await ctx.prisma.user.findUnique({
      where: { username: args.username },
      include: { profile: true },
    });
    if (!user) return null;
    // If profile is private, only the owner can see it
    if (user.profile && !user.profile.isPublic) {
      if (!ctx.user || ctx.user.sub !== user.cognitoSub) {
        return null;
      }
    }
    return user;
  },

  users: async (
    _parent: unknown,
    args: { first: number; after?: string; page?: number },
    ctx: Context,
  ) => {
    requireAuth(ctx); // Require authentication for user list
    const { skip, take, cursorWhere } = buildPaginationArgs({
      first: args.first,
      after: args.after,
      page: args.page,
    });
    const where = cursorWhere ?? {};

    const [items, totalCount] = await Promise.all([
      ctx.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: take + 1,
        include: { profile: true },
      }),
      ctx.prisma.user.count(),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((user) => ({
      cursor: encodeCursor(user.createdAt),
      node: user,
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
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

/**
 * Roles allowed to see a user's email and other admin-only fields.
 * Mirrors the role-restriction logic on adminUsers/adminUserById so that
 * `email` (and friends) is not silently null when admins query them.
 */
const STAFF_ROLES = new Set(['moderator', 'admin', 'superuser']);

/**
 * Loads the caller's role from the DB. Used by the staff-gated field
 * resolvers below. Returns null when the caller is anonymous or the
 * cognitoSub no longer matches a user (e.g. deleted account).
 */
async function getCallerRole(ctx: Context): Promise<string | null> {
  if (!ctx.user) return null;
  const caller = await ctx.prisma.user.findUnique({
    where: { cognitoSub: ctx.user.sub },
    select: { role: true },
  });
  return caller?.role ?? null;
}

export const userFieldResolvers = {
  email: async (parent: UserParent, _args: unknown, ctx: Context) => {
    // Owner always sees their own email.
    if (ctx.user && ctx.user.sub === parent.cognitoSub) {
      const u = await ctx.prisma.user.findUnique({
        where: { id: parent.id },
        select: { email: true },
      });
      return u?.email ?? null;
    }
    // Staff (moderator/admin/superuser) can see other users' emails.
    const callerRole = await getCallerRole(ctx);
    if (callerRole && STAFF_ROLES.has(callerRole)) {
      const u = await ctx.prisma.user.findUnique({
        where: { id: parent.id },
        select: { email: true },
      });
      return u?.email ?? null;
    }
    return null;
  },

  /**
   * Cognito subject identifier — only useful for admin tools and never
   * exposed to non-staff callers.
   */
  cognitoSub: async (parent: UserParent, _args: unknown, ctx: Context) => {
    const callerRole = await getCallerRole(ctx);
    if (!callerRole || !STAFF_ROLES.has(callerRole)) return null;
    if (parent.cognitoSub) return parent.cognitoSub;
    const u = await ctx.prisma.user.findUnique({
      where: { id: parent.id },
      select: { cognitoSub: true },
    });
    return u?.cognitoSub ?? null;
  },

  failedAttempts: async (
    parent: UserParent & { failedAttempts?: number },
    _args: unknown,
    ctx: Context,
  ) => {
    const callerRole = await getCallerRole(ctx);
    if (!callerRole || !STAFF_ROLES.has(callerRole)) return null;
    if (typeof parent.failedAttempts === 'number') return parent.failedAttempts;
    const u = await ctx.prisma.user.findUnique({
      where: { id: parent.id },
      select: { failedAttempts: true },
    });
    return u?.failedAttempts ?? 0;
  },

  lockoutUntil: async (
    parent: UserParent & { lockoutUntil?: Date | string | null },
    _args: unknown,
    ctx: Context,
  ) => {
    const callerRole = await getCallerRole(ctx);
    if (!callerRole || !STAFF_ROLES.has(callerRole)) return null;
    if (parent.lockoutUntil) {
      return typeof parent.lockoutUntil === 'string'
        ? parent.lockoutUntil
        : parent.lockoutUntil.toISOString();
    }
    const u = await ctx.prisma.user.findUnique({
      where: { id: parent.id },
      select: { lockoutUntil: true },
    });
    return u?.lockoutUntil ? u.lockoutUntil.toISOString() : null;
  },

  /**
   * Resolves the user's assigned tier. Falls back to the 'free' tier
   * when User.tierId is null so callers get a stable Tier object even
   * for legacy users that pre-date the tier system.
   */
  tier: async (parent: UserParent & { tierId?: string | null }, _args: unknown, ctx: Context) => {
    let tierId = parent.tierId;
    if (tierId === undefined) {
      const u = await ctx.prisma.user.findUnique({
        where: { id: parent.id },
        select: { tierId: true },
      });
      tierId = u?.tierId ?? null;
    }
    if (tierId) {
      const tier = await ctx.prisma.userTier.findUnique({ where: { id: tierId } });
      if (tier) return tier;
    }
    // Fallback: return the 'free' tier when no explicit assignment.
    return ctx.prisma.userTier.findUnique({ where: { slug: 'free' } });
  },

  profile: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.profile.findUnique({
      where: { userId: parent.id },
    });
  },

  followerCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userFollowerCount.load(parent.id);
  },

  followingCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userFollowingCount.load(parent.id);
  },

  photoCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userPhotoCount.load(parent.id);
  },

  sellerProfile: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.sellerProfile.findUnique({
      where: { userId: parent.id },
    });
  },

  lastLoginAt: (parent: UserParent & { lastLoginAt?: Date | string | null }, _args: unknown) => {
    if (!parent.lastLoginAt) return null;
    if (typeof parent.lastLoginAt === 'string') return parent.lastLoginAt;
    return parent.lastLoginAt.toISOString();
  },

  canSell: (parent: UserParent, _args: unknown, ctx: Context) => {
    // Look up the user's role to determine if they can sell
    return ctx.prisma.user
      .findUnique({
        where: { id: parent.id },
        select: { role: true, sellerProfile: { select: { approved: true } } },
      })
      .then((user) => {
        if (!user) return false;
        // Admin/superuser can always sell
        if (user.role === 'admin' || user.role === 'superuser') return true;
        // Otherwise check seller profile approval
        return user.sellerProfile?.approved ?? false;
      });
  },

  badges: async (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.userBadge.findMany({
      where: { userId: parent.id },
      include: {
        badgeDefinition: true,
        awardedPhoto: { include: { variants: true } },
        awarder: true,
      },
      orderBy: [{ badgeDefinition: { displayOrder: 'asc' } }, { awardedAt: 'desc' }],
    });
  },
};
