import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { getDbUser } from '../utils/resolverHelpers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteSettingsParent {
  id: string;
  bannerUrl: string | null;
  tagline: string | null;
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
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const siteSettingsMutationResolvers = {
  updateSiteSettings: async (
    _parent: unknown,
    args: { input: { bannerUrl?: string | null; tagline?: string | null } },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    if (!['admin', 'superuser'].includes(dbUser.role)) {
      throw new GraphQLError('Only admins can update site settings', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return ctx.prisma.siteSettings.upsert({
      where: { id: 'site_settings' },
      create: {
        id: 'site_settings',
        bannerUrl: args.input.bannerUrl ?? null,
        tagline: args.input.tagline ?? null,
      },
      update: {
        bannerUrl: args.input.bannerUrl ?? null,
        tagline: args.input.tagline ?? null,
      },
    });
  },
};
