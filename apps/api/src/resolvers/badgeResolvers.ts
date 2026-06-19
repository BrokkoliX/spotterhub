import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { getObjectUrl } from '../services/s3.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireSuperuser(ctx: Context) {
  const authUser = requireAuth(ctx);
  const dbUser = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
    select: { id: true, role: true },
  });
  if (!dbUser) {
    throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
  }
  if (dbUser.role !== 'superuser') {
    throw new GraphQLError('Only superusers can manage badges', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return dbUser;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const badgeQueryResolvers = {
  badgeDefinitions: async (
    _parent: unknown,
    args: { category?: string; isActive?: boolean },
    ctx: Context,
  ) => {
    const where: Record<string, unknown> = {};
    if (args.category) where.category = args.category;
    if (args.isActive !== undefined) where.isActive = args.isActive;

    return ctx.prisma.badgeDefinition.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { tier: 'asc' }],
    });
  },

  userBadges: async (_parent: unknown, args: { userId: string }, ctx: Context) => {
    return ctx.prisma.userBadge.findMany({
      where: { userId: args.userId },
      include: {
        badgeDefinition: true,
        awardedPhoto: { include: { variants: true } },
        awarder: true,
        user: true,
      },
      orderBy: { awardedAt: 'desc' },
    });
  },

  photoAwards: async (_parent: unknown, args: { period: string; first?: number }, ctx: Context) => {
    const take = Math.min(args.first ?? 10, 50);
    return ctx.prisma.photoAward.findMany({
      where: { period: args.period as 'DAY' | 'WEEK' | 'MONTH' },
      include: {
        photo: { include: { user: true, variants: true } },
      },
      orderBy: { periodStart: 'desc' },
      take,
    });
  },
};

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const badgeMutationResolvers = {
  createBadgeDefinition: async (
    _parent: unknown,
    args: { input: Record<string, unknown> },
    ctx: Context,
  ) => {
    await requireSuperuser(ctx);

    const { slug, name, description, category, tier, triggerType, ...rest } = args.input;

    // iconUrl arrives as an S3 key from the client (returned by getUploadUrl);
    // convert it to a public URL so the stored value is renderable as-is.
    const iconKey = rest.iconUrl as string | undefined;
    const iconUrl = iconKey ? getObjectUrl(iconKey) : null;

    return ctx.prisma.badgeDefinition.create({
      data: {
        slug: slug as string,
        name: name as string,
        description: description as string,
        category: category as
          | 'UPLOAD'
          | 'ENGAGEMENT'
          | 'COMMUNITY'
          | 'STREAK'
          | 'DIVERSITY'
          | 'AWARD',
        tier: tier as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM',
        triggerType: triggerType as 'AUTOMATIC' | 'AWARDED',
        iconUrl,
        triggerMetric: (rest.triggerMetric as string) ?? null,
        triggerThreshold: (rest.triggerThreshold as number) ?? null,
        isActive: (rest.isActive as boolean) ?? true,
        isRepeatable: (rest.isRepeatable as boolean) ?? false,
        displayOrder: (rest.displayOrder as number) ?? 0,
      },
    });
  },

  updateBadgeDefinition: async (
    _parent: unknown,
    args: { id: string; input: Record<string, unknown> },
    ctx: Context,
  ) => {
    await requireSuperuser(ctx);

    const existing = await ctx.prisma.badgeDefinition.findUnique({ where: { id: args.id } });
    if (!existing) {
      throw new GraphQLError('Badge definition not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Same key→URL conversion as create. Only touch iconUrl when the caller
    // actually provided it, so partial updates don't clobber the existing value.
    const data: Record<string, unknown> = { ...args.input };
    if (typeof data.iconUrl === 'string' && data.iconUrl.length > 0) {
      data.iconUrl = getObjectUrl(data.iconUrl);
    } else if (data.iconUrl === null) {
      data.iconUrl = null;
    } else {
      delete data.iconUrl;
    }

    return ctx.prisma.badgeDefinition.update({
      where: { id: args.id },
      data,
    });
  },

  deleteBadgeDefinition: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireSuperuser(ctx);

    const existing = await ctx.prisma.badgeDefinition.findUnique({ where: { id: args.id } });
    if (!existing) {
      throw new GraphQLError('Badge definition not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.badgeDefinition.delete({ where: { id: args.id } });
    return true;
  },

  awardBadge: async (
    _parent: unknown,
    args: { userId: string; badgeDefinitionId: string; photoId?: string },
    ctx: Context,
  ) => {
    const superuser = await requireSuperuser(ctx);

    const badge = await ctx.prisma.badgeDefinition.findUnique({
      where: { id: args.badgeDefinitionId },
    });
    if (!badge) {
      throw new GraphQLError('Badge definition not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const targetUser = await ctx.prisma.user.findUnique({ where: { id: args.userId } });
    if (!targetUser) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Dedup logic depends on whether the badge is repeatable. Non-repeatable
    // badges can be earned at most once per user. Repeatable badges (e.g.
    // Admin's Choice of the Week, Photo of the Day) can be earned multiple
    // times — but not twice for the exact same photo.
    if (!badge.isRepeatable) {
      const existing = await ctx.prisma.userBadge.findFirst({
        where: { userId: args.userId, badgeDefinitionId: args.badgeDefinitionId },
      });
      if (existing) {
        throw new GraphQLError('User already has this badge', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    } else if (args.photoId) {
      const existingForPhoto = await ctx.prisma.userBadge.findFirst({
        where: {
          userId: args.userId,
          badgeDefinitionId: args.badgeDefinitionId,
          awardedPhotoId: args.photoId,
        },
      });
      if (existingForPhoto) {
        throw new GraphQLError('This photo has already received this badge', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    const userBadge = await ctx.prisma.userBadge.create({
      data: {
        userId: args.userId,
        badgeDefinitionId: args.badgeDefinitionId,
        awardedPhotoId: args.photoId ?? null,
        awardedBy: superuser.id,
      },
      include: {
        badgeDefinition: true,
        awardedPhoto: { include: { variants: true } },
        awarder: true,
        user: true,
      },
    });

    // Notify the recipient. Include photo context when a photo is tied.
    await ctx.prisma.notification.create({
      data: {
        userId: args.userId,
        type: 'badge_earned',
        title: `🏆 Badge earned: ${badge.name} (${badge.tier})`,
        body: args.photoId
          ? `${badge.description} — awarded for one of your photos.`
          : badge.description,
        data: { badgeSlug: badge.slug, badgeId: badge.id, photoId: args.photoId ?? null },
      },
    });

    return userBadge;
  },

  revokeBadge: async (
    _parent: unknown,
    args: { userId: string; badgeDefinitionId: string; userBadgeId?: string },
    ctx: Context,
  ) => {
    await requireSuperuser(ctx);

    // When userBadgeId is supplied, revoke that specific row — required
    // for repeatable badges where multiple rows can exist for the same
    // (userId, badgeDefinitionId) pair (e.g. Admin's Choice of the Week
    // earned on three different photos).
    if (args.userBadgeId) {
      const existing = await ctx.prisma.userBadge.findFirst({
        where: {
          id: args.userBadgeId,
          userId: args.userId,
          badgeDefinitionId: args.badgeDefinitionId,
        },
      });
      if (!existing) {
        throw new GraphQLError('Badge award not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      await ctx.prisma.userBadge.delete({ where: { id: existing.id } });
      return true;
    }

    // Otherwise, revoke any rows matching the user+badge pair. For
    // non-repeatable badges this matches at most one row.
    const result = await ctx.prisma.userBadge.deleteMany({
      where: { userId: args.userId, badgeDefinitionId: args.badgeDefinitionId },
    });
    if (result.count === 0) {
      throw new GraphQLError('User does not have this badge', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    return true;
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const badgeFieldResolvers = {
  UserBadge: {
    badgeDefinition: (
      parent: { badgeDefinition?: unknown; badgeDefinitionId: string },
      _args: unknown,
      ctx: Context,
    ) => {
      if (parent.badgeDefinition) return parent.badgeDefinition;
      return ctx.prisma.badgeDefinition.findUnique({ where: { id: parent.badgeDefinitionId } });
    },
    user: (parent: { user?: unknown; userId: string }, _args: unknown, ctx: Context) => {
      if (parent.user) return parent.user;
      return ctx.prisma.user.findUnique({ where: { id: parent.userId } });
    },
    awardedPhoto: (
      parent: { awardedPhoto?: unknown; awardedPhotoId?: string | null },
      _args: unknown,
      ctx: Context,
    ) => {
      if (parent.awardedPhoto) return parent.awardedPhoto;
      if (!parent.awardedPhotoId) return null;
      return ctx.prisma.photo.findUnique({
        where: { id: parent.awardedPhotoId },
        include: { variants: true },
      });
    },
    awarder: (
      parent: { awarder?: unknown; awardedBy?: string | null },
      _args: unknown,
      ctx: Context,
    ) => {
      if (parent.awarder) return parent.awarder;
      if (!parent.awardedBy) return null;
      return ctx.prisma.user.findUnique({ where: { id: parent.awardedBy } });
    },
  },
};

// ─── Badge Award Engine ─────────────────────────────────────────────────────

export async function checkAndAwardBadges(
  ctx: Context,
  userId: string,
  metric: string,
): Promise<string[]> {
  const definitions = await ctx.prisma.badgeDefinition.findMany({
    where: {
      triggerType: 'AUTOMATIC',
      triggerMetric: metric,
      isActive: true,
    },
    orderBy: { triggerThreshold: 'asc' },
  });

  if (definitions.length === 0) return [];

  const existingBadges = await ctx.prisma.userBadge.findMany({
    where: {
      userId,
      badgeDefinitionId: { in: definitions.map((d) => d.id) },
    },
    select: { badgeDefinitionId: true },
  });
  const existingSet = new Set(existingBadges.map((b) => b.badgeDefinitionId));

  const value = await computeMetricValue(ctx, userId, metric);

  const newBadgeIds: string[] = [];
  for (const def of definitions) {
    if (existingSet.has(def.id)) continue;
    if (def.triggerThreshold !== null && value >= def.triggerThreshold) {
      await ctx.prisma.userBadge.create({
        data: { userId, badgeDefinitionId: def.id },
      });
      newBadgeIds.push(def.id);
    }
  }

  if (newBadgeIds.length > 0) {
    const newBadges = definitions.filter((d) => newBadgeIds.includes(d.id));
    for (const badge of newBadges) {
      await ctx.prisma.notification.create({
        data: {
          userId,
          type: 'badge_earned',
          title: `🏆 Badge earned: ${badge.name} (${badge.tier})`,
          body: badge.description,
          data: { badgeSlug: badge.slug, badgeId: badge.id },
        },
      });
    }
  }

  return newBadgeIds;
}

async function computeMetricValue(ctx: Context, userId: string, metric: string): Promise<number> {
  switch (metric) {
    case 'photo_count':
      return ctx.prisma.photo.count({
        where: { userId, moderationStatus: 'approved' },
      });

    case 'like_received_count': {
      const result = await ctx.prisma.photo.aggregate({
        where: { userId, moderationStatus: 'approved' },
        _sum: { likeCount: true },
      });
      return result._sum.likeCount ?? 0;
    }

    case 'comment_count':
      return ctx.prisma.comment.count({ where: { userId } });

    case 'community_join_count':
      return ctx.prisma.communityMember.count({ where: { userId } });

    case 'community_created_count':
      return ctx.prisma.community.count({ where: { ownerId: userId } });

    case 'unique_airport_count': {
      const airports = await ctx.prisma.photo.findMany({
        where: { userId, airportCode: { not: null }, moderationStatus: 'approved' },
        select: { airportCode: true },
        distinct: ['airportCode'],
      });
      return airports.length;
    }

    case 'upload_streak_days': {
      const dates = await ctx.prisma.$queryRawUnsafe<{ upload_date: Date }[]>(
        `SELECT DISTINCT DATE(created_at) as upload_date 
         FROM photos 
         WHERE user_id = $1::uuid AND moderation_status = 'approved'
         ORDER BY upload_date DESC`,
        userId,
      );
      if (dates.length === 0) return 0;

      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1].upload_date);
        const curr = new Date(dates[i].upload_date);
        const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (Math.round(diffDays) === 1) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    default:
      return 0;
  }
}
