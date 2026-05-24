import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { getDbUser } from '../utils/resolverHelpers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTierInput {
  slug: string;
  name: string;
  priceCents?: number | null;
  currency?: string | null;
  uploadsPerDay?: number | null;
  uploadsPerWeek?: number | null;
  canCreateCommunity?: boolean | null;
  displayOrder?: number | null;
  isActive?: boolean | null;
}

export interface UpdateTierInput {
  name?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  uploadsPerDay?: number | null;
  uploadsPerWeek?: number | null;
  canCreateCommunity?: boolean | null;
  displayOrder?: number | null;
  isActive?: boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

async function requireSuperuser(ctx: Context, action: string): Promise<void> {
  const dbUser = await getDbUser(ctx);
  if (dbUser.role !== 'superuser') {
    throw new GraphQLError(`Only superusers can ${action}`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length < 2 || slug.length > 40) {
    throw new GraphQLError(
      'slug must be 2–40 characters of lowercase letters, digits, hyphens, or underscores',
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
}

function validateName(name: string): void {
  if (name.trim().length < 2 || name.length > 60) {
    throw new GraphQLError('name must be 2–60 characters', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

function validateCurrency(currency: string): void {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new GraphQLError('currency must be a 3-letter ISO-4217 code (e.g. USD)', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

function validateNonNegativeInt(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new GraphQLError(`${fieldName} must be a non-negative integer`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

function validateNullableUploadCap(value: number | null | undefined, fieldName: string): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0 || value > 100000) {
    throw new GraphQLError(`${fieldName} must be a non-negative integer ≤ 100000, or null`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const tierQueryResolvers = {
  /**
   * Public list of active tiers, intended for an eventual user-facing
   * pricing page. Inactive tiers are excluded so the public never sees a
   * tier the superuser has retired.
   */
  tiers: async (_parent: unknown, _args: unknown, ctx: Context) => {
    return ctx.prisma.userTier.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { priceCents: 'asc' }],
    });
  },

  /**
   * Superuser-only: returns every tier (including inactive ones) for the
   * /admin/tiers management page.
   */
  adminTiers: async (_parent: unknown, _args: unknown, ctx: Context) => {
    await requireSuperuser(ctx, 'view all tiers');
    return ctx.prisma.userTier.findMany({
      orderBy: [{ displayOrder: 'asc' }, { priceCents: 'asc' }],
    });
  },
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const tierMutationResolvers = {
  createTier: async (_parent: unknown, args: { input: CreateTierInput }, ctx: Context) => {
    await requireSuperuser(ctx, 'create a tier');

    validateSlug(args.input.slug);
    validateName(args.input.name);
    if (args.input.currency != null) validateCurrency(args.input.currency);
    if (args.input.priceCents != null) validateNonNegativeInt(args.input.priceCents, 'priceCents');
    if (args.input.displayOrder != null) {
      validateNonNegativeInt(args.input.displayOrder, 'displayOrder');
    }
    validateNullableUploadCap(args.input.uploadsPerDay, 'uploadsPerDay');
    validateNullableUploadCap(args.input.uploadsPerWeek, 'uploadsPerWeek');

    // Reject duplicate slugs up-front for a friendlier error than the raw
    // unique-constraint violation that Prisma would otherwise throw.
    const existing = await ctx.prisma.userTier.findUnique({
      where: { slug: args.input.slug },
    });
    if (existing) {
      throw new GraphQLError(`A tier with slug '${args.input.slug}' already exists`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.userTier.create({
      data: {
        slug: args.input.slug,
        name: args.input.name.trim(),
        priceCents: args.input.priceCents ?? 0,
        currency: args.input.currency ?? 'USD',
        uploadsPerDay: args.input.uploadsPerDay ?? null,
        uploadsPerWeek: args.input.uploadsPerWeek ?? null,
        canCreateCommunity: args.input.canCreateCommunity ?? false,
        displayOrder: args.input.displayOrder ?? 0,
        isActive: args.input.isActive ?? true,
      },
    });
  },

  updateTier: async (
    _parent: unknown,
    args: { id: string; input: UpdateTierInput },
    ctx: Context,
  ) => {
    await requireSuperuser(ctx, 'update a tier');

    if (args.input.name != null) validateName(args.input.name);
    if (args.input.currency != null) validateCurrency(args.input.currency);
    if (args.input.priceCents != null) validateNonNegativeInt(args.input.priceCents, 'priceCents');
    if (args.input.displayOrder != null) {
      validateNonNegativeInt(args.input.displayOrder, 'displayOrder');
    }
    validateNullableUploadCap(args.input.uploadsPerDay, 'uploadsPerDay');
    validateNullableUploadCap(args.input.uploadsPerWeek, 'uploadsPerWeek');

    const existing = await ctx.prisma.userTier.findUnique({ where: { id: args.id } });
    if (!existing) {
      throw new GraphQLError('Tier not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Build a sparse update object so unspecified fields stay as-is.
    const data: Record<string, unknown> = {};
    if (args.input.name != null) data.name = args.input.name.trim();
    if (args.input.priceCents != null) data.priceCents = args.input.priceCents;
    if (args.input.currency != null) data.currency = args.input.currency;
    // Upload caps are nullable — explicit null clears the cap (= unlimited).
    if (args.input.uploadsPerDay !== undefined) data.uploadsPerDay = args.input.uploadsPerDay;
    if (args.input.uploadsPerWeek !== undefined) data.uploadsPerWeek = args.input.uploadsPerWeek;
    if (args.input.canCreateCommunity != null) {
      data.canCreateCommunity = args.input.canCreateCommunity;
    }
    if (args.input.displayOrder != null) data.displayOrder = args.input.displayOrder;
    if (args.input.isActive != null) data.isActive = args.input.isActive;

    return ctx.prisma.userTier.update({ where: { id: args.id }, data });
  },

  deleteTier: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireSuperuser(ctx, 'delete a tier');

    const tier = await ctx.prisma.userTier.findUnique({ where: { id: args.id } });
    if (!tier) {
      throw new GraphQLError('Tier not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Refuse to orphan the 'free' tier — too much code (User.tier resolver
    // fallback, photoResolvers, etc.) implicitly depends on its existence.
    if (tier.slug === 'free') {
      throw new GraphQLError("The 'free' tier cannot be deleted; deactivate it instead", {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const assignedCount = await ctx.prisma.user.count({ where: { tierId: args.id } });
    if (assignedCount > 0) {
      throw new GraphQLError(
        `Cannot delete tier: ${assignedCount} user(s) still assigned. Reassign them first.`,
        { extensions: { code: 'FAILED_PRECONDITION' } },
      );
    }

    await ctx.prisma.userTier.delete({ where: { id: args.id } });
    return true;
  },
};
