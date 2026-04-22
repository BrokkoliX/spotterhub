import { GraphQLError } from 'graphql';

import { requireAuth, requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// Metadata validation rules per listType
const METADATA_VALIDATION: Record<string, { required: string[]; optional: string[] }> = {
  manufacturer: { required: [], optional: ['country'] },
  family: { required: ['manufacturerId'], optional: [] },
  variant: { required: ['familyId'], optional: ['aircraftTypeId'] },
  airline: { required: [], optional: ['icaoCode', 'iataCode', 'country', 'callsign'] },
  photo_category: { required: [], optional: ['label'] },
  aircraft_specific_category: { required: [], optional: ['label'] },
};

const VALID_LIST_TYPES = Object.keys(METADATA_VALIDATION);
const VALID_STATUSES = ['pending', 'approved', 'rejected'];

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const pendingListItemQueryResolvers = {
  pendingListItems: async (
    _parent: unknown,
    args: { status?: string; listType?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {};
    if (args.status) {
      where.status = args.status;
    }
    if (args.listType) {
      where.listType = args.listType;
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.pendingListItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: { submitter: true, reviewer: true },
      }),
      ctx.prisma.pendingListItem.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((item) => ({
      cursor: item.id,
      node: item,
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

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const pendingListItemMutationResolvers = {
  submitListItem: async (
    _parent: unknown,
    args: { input: { listType: string; value: string; metadata?: unknown } },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Validate listType
    if (!VALID_LIST_TYPES.includes(args.input.listType)) {
      throw new GraphQLError(`Invalid listType. Must be one of: ${VALID_LIST_TYPES.join(', ')}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate metadata against listType rules
    const metadata = args.input.metadata as Record<string, unknown> | undefined;
    const rules = METADATA_VALIDATION[args.input.listType];

    if (rules.required.length > 0) {
      for (const field of rules.required) {
        if (!metadata || metadata[field] === undefined) {
          throw new GraphQLError(
            `metadata.${field} is required for listType '${args.input.listType}'`,
            { extensions: { code: 'BAD_USER_INPUT' } },
          );
        }
      }
    }

    // Create the pending item
    const pendingItem = await ctx.prisma.pendingListItem.create({
      data: {
        listType: args.input.listType,
        value: args.input.value,
        metadata: (metadata as unknown) ?? undefined,
        submittedBy: user.id,
        status: 'pending',
      },
      include: { submitter: true, reviewer: true },
    });

    // Create notification for admins
    const admins = await ctx.prisma.user.findMany({
      where: { role: { in: ['admin', 'superuser'] } },
      select: { id: true },
    });

    const listTypeLabel = args.input.listType.replace(/_/g, ' ');

    await ctx.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'system',
        title: `New pending ${listTypeLabel}`,
        body: `New ${listTypeLabel}: ${args.input.value} — submitted by ${user.username}`,
        data: { pendingListItemId: pendingItem.id, listType: args.input.listType },
      })),
    });

    return pendingItem;
  },

  reviewListItem: async (
    _parent: unknown,
    args: { id: string; status: string; reviewNote?: string },
    ctx: Context,
  ) => {
    const authUser = await requireRole(ctx, ['admin', 'superuser']);

    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
    });
    if (!dbUser) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const existing = await ctx.prisma.pendingListItem.findUnique({
      where: { id: args.id },
      include: { submitter: true },
    });
    if (!existing) {
      throw new GraphQLError('Pending list item not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Validate status
    if (!VALID_STATUSES.includes(args.status)) {
      throw new GraphQLError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // If approving, create the actual entity
    if (args.status === 'approved') {
      await createApprovedEntity(
        ctx,
        existing.listType,
        existing.value,
        existing.metadata as Record<string, unknown> | null,
      );
    }

    // Update the pending item
    const updated = await ctx.prisma.pendingListItem.update({
      where: { id: args.id },
      data: {
        status: args.status,
        reviewedBy: dbUser.id,
        reviewNote: args.reviewNote ?? null,
      },
      include: { submitter: true, reviewer: true },
    });

    // Notify the submitter
    await ctx.prisma.notification.create({
      data: {
        userId: existing.submittedBy,
        type: 'system',
        title: `Pending item ${args.status}`,
        body:
          args.status === 'approved'
            ? `Your submission '${existing.value}' has been approved.`
            : `Your submission '${existing.value}' has been rejected.${args.reviewNote ? ` Reason: ${args.reviewNote}` : ''}`,
        data: { pendingListItemId: existing.id },
      },
    });

    return updated;
  },
};

// Helper to create the approved entity
async function createApprovedEntity(
  ctx: Context,
  listType: string,
  value: string,
  metadata: Record<string, unknown> | null,
) {
  switch (listType) {
    case 'manufacturer':
      await ctx.prisma.aircraftManufacturer.create({
        data: { name: value, country: (metadata?.country as string) ?? null },
      });
      break;

    case 'family':
      if (!metadata?.manufacturerId) {
        throw new GraphQLError('manufacturerId is required for family', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      await ctx.prisma.aircraftFamily.create({
        data: { name: value, manufacturerId: metadata.manufacturerId as string },
      });
      break;

    case 'variant':
      if (!metadata?.familyId) {
        throw new GraphQLError('familyId is required for variant', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      await ctx.prisma.aircraftVariant.create({
        data: {
          name: value,
          familyId: metadata.familyId as string,
        },
      });
      break;

    case 'airline':
      await ctx.prisma.airline.create({
        data: {
          name: value,
          icaoCode: (metadata?.icaoCode as string) ?? null,
          iataCode: (metadata?.iataCode as string) ?? null,
          country: (metadata?.country as string) ?? null,
          callsign: (metadata?.callsign as string) ?? null,
        },
      });
      break;

    case 'photo_category':
      await ctx.prisma.photoCategory.create({
        data: {
          name: value,
          label: (metadata?.label as string) ?? value,
          sortOrder: 0,
        },
      });
      break;

    case 'aircraft_specific_category':
      await ctx.prisma.aircraftSpecificCategory.create({
        data: {
          name: value,
          label: (metadata?.label as string) ?? value,
          sortOrder: 0,
        },
      });
      break;

    default:
      throw new GraphQLError(`Unknown listType: ${listType}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
  }
}

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export const pendingListItemFieldResolvers = {
  PendingListItem: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    submitter: (parent: { submittedBy: string }, _args: unknown, ctx: Context) => {
      return ctx.prisma.user.findUnique({ where: { id: parent.submittedBy } });
    },
    reviewer: (parent: { reviewedBy: string | null }, _args: unknown, ctx: Context) => {
      if (!parent.reviewedBy) return null;
      return ctx.prisma.user.findUnique({ where: { id: parent.reviewedBy } });
    },
  },
};
