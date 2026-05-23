import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { getDbUser } from '../utils/resolverHelpers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteSettingsParent {
  id: string;
  bannerUrl: string | null;
  tagline: string | null;
  minPhotoLongEdge: number;
  maxPhotoLongEdge: number;
  photoUploadTimeoutSeconds: number;
  accessTokenSeconds: number;
  refreshTokenSeconds: number;
}

export interface AdSettingsParent {
  enabled: boolean;
  adSenseClientId: string;
  slotFeed: string | null;
  slotPhotoDetail: string | null;
  slotSidebar: string | null;
}

// ─── Query Resolvers ─────────────────────────────────────────────────────────

export const siteSettingsQueryResolvers = {
  siteSettings: async (_parent: unknown, _args: unknown, ctx: Context) => {
    let settings = await ctx.prisma.siteSettings.findUnique({
      where: { id: 'site_settings' },
    });
    if (!settings) {
      // Auto-create the singleton record on first access
      settings = await ctx.prisma.siteSettings.create({
        data: { id: 'site_settings' },
      });
    }
    return settings;
  },

  adSettings: async (_parent: unknown, _args: unknown, ctx: Context) => {
    let settings = await ctx.prisma.adSettings.findUnique({
      where: { id: 'ad_settings' },
    });
    if (!settings) {
      settings = await ctx.prisma.adSettings.create({
        data: { id: 'ad_settings' },
      });
    }
    return settings;
  },
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const siteSettingsMutationResolvers = {
  updateSiteSettings: async (
    _parent: unknown,
    args: {
      input: {
        bannerUrl?: string | null;
        tagline?: string | null;
        minPhotoLongEdge?: number | null;
        maxPhotoLongEdge?: number | null;
        photoUploadTimeoutSeconds?: number | null;
        accessTokenSeconds?: number | null;
        refreshTokenSeconds?: number | null;
      };
    },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    if (dbUser.role !== 'superuser') {
      throw new GraphQLError('Only superusers can update site settings', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate photo dimension limits if provided
    const minEdge = args.input.minPhotoLongEdge;
    const maxEdge = args.input.maxPhotoLongEdge;

    if (minEdge != null && (minEdge < 100 || minEdge > 10000)) {
      throw new GraphQLError('minPhotoLongEdge must be between 100 and 10000', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (maxEdge != null && (maxEdge < 100 || maxEdge > 10000)) {
      throw new GraphQLError('maxPhotoLongEdge must be between 100 and 10000', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (minEdge != null && maxEdge != null && minEdge >= maxEdge) {
      throw new GraphQLError('minPhotoLongEdge must be less than maxPhotoLongEdge', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const timeout = args.input.photoUploadTimeoutSeconds;
    if (timeout != null && (timeout < 30 || timeout > 3600)) {
      throw new GraphQLError('photoUploadTimeoutSeconds must be between 30 and 3600', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // ── Session-token lifetime validation ──
    // Access tokens may live 1 minute to 24 hours. Anything shorter creates
    // user-visible refresh churn; anything longer extends the blast radius
    // of a stolen JWT (which we cannot revoke server-side).
    const accessTokenSeconds = args.input.accessTokenSeconds;
    if (accessTokenSeconds != null && (accessTokenSeconds < 60 || accessTokenSeconds > 86400)) {
      throw new GraphQLError(
        'accessTokenSeconds must be between 60 (1 minute) and 86400 (24 hours)',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }
    // Refresh tokens may live 1 hour to 30 days. The lower bound matches the
    // floor at which the refresh model is even useful; the upper bound is a
    // pragmatic ceiling for opaque tokens stored in the DB.
    const refreshTokenSeconds = args.input.refreshTokenSeconds;
    if (
      refreshTokenSeconds != null &&
      (refreshTokenSeconds < 3600 || refreshTokenSeconds > 2592000)
    ) {
      throw new GraphQLError(
        'refreshTokenSeconds must be between 3600 (1 hour) and 2592000 (30 days)',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }
    // Cross-field check: resolved access TTL must be < resolved refresh TTL.
    // If only one of the two is being updated, compare against the current
    // persisted value of the other so partial updates don't false-positive.
    if (accessTokenSeconds != null || refreshTokenSeconds != null) {
      const current = await ctx.prisma.siteSettings.findUnique({
        where: { id: 'site_settings' },
      });
      const resolvedAccess = accessTokenSeconds ?? current?.accessTokenSeconds ?? 3600;
      const resolvedRefresh = refreshTokenSeconds ?? current?.refreshTokenSeconds ?? 604800;
      if (resolvedAccess >= resolvedRefresh) {
        throw new GraphQLError('accessTokenSeconds must be less than refreshTokenSeconds', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    const data: Record<string, unknown> = {
      bannerUrl: args.input.bannerUrl ?? null,
      tagline: args.input.tagline ?? null,
    };
    if (minEdge != null) data.minPhotoLongEdge = minEdge;
    if (maxEdge != null) data.maxPhotoLongEdge = maxEdge;
    if (timeout != null) data.photoUploadTimeoutSeconds = timeout;
    if (accessTokenSeconds != null) data.accessTokenSeconds = accessTokenSeconds;
    if (refreshTokenSeconds != null) data.refreshTokenSeconds = refreshTokenSeconds;

    return ctx.prisma.siteSettings.upsert({
      where: { id: 'site_settings' },
      create: {
        id: 'site_settings',
        ...data,
      },
      update: data,
    });
  },

  updateAdSettings: async (
    _parent: unknown,
    args: {
      input: {
        enabled?: boolean | null;
        adSenseClientId?: string | null;
        slotFeed?: string | null;
        slotPhotoDetail?: string | null;
        slotSidebar?: string | null;
      };
    },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    if (dbUser.role !== 'superuser') {
      throw new GraphQLError('Only superusers can update ad settings', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const data: Record<string, unknown> = {};
    if (args.input.enabled != null) data.enabled = args.input.enabled;
    if (args.input.adSenseClientId != null) data.adSenseClientId = args.input.adSenseClientId;
    if (args.input.slotFeed != null) data.slotFeed = args.input.slotFeed;
    if (args.input.slotPhotoDetail != null) data.slotPhotoDetail = args.input.slotPhotoDetail;
    if (args.input.slotSidebar != null) data.slotSidebar = args.input.slotSidebar;

    return ctx.prisma.adSettings.upsert({
      where: { id: 'ad_settings' },
      create: {
        id: 'ad_settings',
        ...data,
      },
      update: data,
    });
  },
};
