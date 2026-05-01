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

    const data: Record<string, unknown> = {
      bannerUrl: args.input.bannerUrl ?? null,
      tagline: args.input.tagline ?? null,
    };
    if (minEdge != null) data.minPhotoLongEdge = minEdge;
    if (maxEdge != null) data.maxPhotoLongEdge = maxEdge;
    if (timeout != null) data.photoUploadTimeoutSeconds = timeout;

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
