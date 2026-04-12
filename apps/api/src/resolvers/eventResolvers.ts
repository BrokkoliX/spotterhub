import { EventRsvpStatus } from '@prisma/client';
import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser } from '../utils/resolverHelpers.js';

import { createNotification } from './notificationResolvers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommunityEventParent {
  id: string;
  communityId: string;
  organizerId: string;
  startsAt: Date;
  endsAt: Date | null;
  maxAttendees: number | null;
}

export interface EventAttendeeParent {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  joinedAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const roleWeight: Record<string, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

async function getMemberRole(ctx: Context, userId: string, communityId: string) {
  const member = await ctx.prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

const VALID_RSVP_STATUSES = ['going', 'maybe', 'not_going'];

// ─── Queries ────────────────────────────────────────────────────────────────

export const eventQueryResolvers = {
  communityEvents: async (
    _parent: unknown,
    args: { communityId: string; first?: number; after?: string; includePast?: boolean },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    const now = new Date();

    let whereClause: Record<string, unknown> = { communityId: args.communityId };

    if (!args.includePast) {
      whereClause = {
        communityId: args.communityId,
        OR: [
          { endsAt: { gte: now } },
          { endsAt: null, startsAt: { gte: now } },
        ],
      };
    }

    if (args.after) {
      const cursor = decodeCursor(args.after);
      whereClause.startsAt = { gt: cursor };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.communityEvent.findMany({
        where: whereClause,
        orderBy: { startsAt: 'asc' },
        take: take + 1,
      }),
      ctx.prisma.communityEvent.count({ where: { communityId: args.communityId } }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((event) => ({
      cursor: encodeCursor(event.startsAt),
      node: event,
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

  communityEvent: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    return ctx.prisma.communityEvent.findUnique({ where: { id: args.id } });
  },
};

// ─── Mutations ──────────────────────────────────────────────────────────────

export const eventMutationResolvers = {
  createCommunityEvent: async (
    _parent: unknown,
    args: {
      communityId: string;
      input: {
        title: string;
        description?: string;
        location?: string;
        startsAt: string;
        endsAt?: string;
        maxAttendees?: number;
        coverUrl?: string;
      };
    },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const isSuperuser = dbUser.role === 'superuser';
    const role = await getMemberRole(ctx, dbUser.id, args.communityId);

    if (!isSuperuser && (!role || roleWeight[role] < roleWeight['admin'])) {
      throw new GraphQLError('Only community owners and admins can create events', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const startsAt = new Date(args.input.startsAt);
    if (isNaN(startsAt.getTime())) {
      throw new GraphQLError('Invalid startsAt date', { extensions: { code: 'BAD_USER_INPUT' } });
    }

    const endsAt = args.input.endsAt ? new Date(args.input.endsAt) : null;
    if (endsAt && isNaN(endsAt.getTime())) {
      throw new GraphQLError('Invalid endsAt date', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    if (endsAt && endsAt <= startsAt) {
      throw new GraphQLError('endsAt must be after startsAt', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.communityEvent.create({
      data: {
        communityId: args.communityId,
        organizerId: dbUser.id,
        title: args.input.title,
        description: args.input.description,
        location: args.input.location,
        startsAt,
        ...(endsAt && { endsAt }),
        maxAttendees: args.input.maxAttendees,
        coverUrl: args.input.coverUrl,
      },
    });
  },

  updateCommunityEvent: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        title?: string;
        description?: string;
        location?: string;
        startsAt?: string;
        endsAt?: string;
        maxAttendees?: number;
        coverUrl?: string;
      };
    },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const isSuperuser = dbUser.role === 'superuser';
    const event = await ctx.prisma.communityEvent.findUnique({ where: { id: args.id } });
    if (!event) {
      throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const role = await getMemberRole(ctx, dbUser.id, event.communityId);
    const isOrganizer = event.organizerId === dbUser.id;
    const isAdminPlus = isSuperuser || (role !== null && roleWeight[role] >= roleWeight['admin']);

    if (!isOrganizer && !isAdminPlus) {
      throw new GraphQLError('Only the organizer or an admin can update this event', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (args.input.title !== undefined) updateData.title = args.input.title;
    if (args.input.description !== undefined) updateData.description = args.input.description;
    if (args.input.location !== undefined) updateData.location = args.input.location;
    if (args.input.maxAttendees !== undefined) updateData.maxAttendees = args.input.maxAttendees;
    if (args.input.coverUrl !== undefined) updateData.coverUrl = args.input.coverUrl;

    if (args.input.startsAt !== undefined) {
      const d = new Date(args.input.startsAt);
      if (isNaN(d.getTime())) {
        throw new GraphQLError('Invalid startsAt', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      updateData.startsAt = d;
    }
    if (args.input.endsAt !== undefined) {
      const d = new Date(args.input.endsAt);
      if (isNaN(d.getTime())) {
        throw new GraphQLError('Invalid endsAt', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      updateData.endsAt = d;
    }

    return ctx.prisma.communityEvent.update({ where: { id: args.id }, data: updateData });
  },

  deleteCommunityEvent: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const isSuperuser = dbUser.role === 'superuser';
    const event = await ctx.prisma.communityEvent.findUnique({ where: { id: args.id } });
    if (!event) {
      throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const role = await getMemberRole(ctx, dbUser.id, event.communityId);
    const isOrganizer = event.organizerId === dbUser.id;
    const isAdminPlus = isSuperuser || (role !== null && roleWeight[role] >= roleWeight['admin']);

    if (!isOrganizer && !isAdminPlus) {
      throw new GraphQLError('Only the organizer or an admin can delete this event', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.communityEvent.delete({ where: { id: args.id } });
    return true;
  },

  rsvpEvent: async (
    _parent: unknown,
    args: { eventId: string; status: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    if (!VALID_RSVP_STATUSES.includes(args.status)) {
      throw new GraphQLError(
        `Invalid status. Must be one of: ${VALID_RSVP_STATUSES.join(', ')}`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const event = await ctx.prisma.communityEvent.findUnique({ where: { id: args.eventId } });
    if (!event) {
      throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const role = await getMemberRole(ctx, dbUser.id, event.communityId);
    if (!role) {
      throw new GraphQLError('You must be a community member to RSVP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Enforce capacity only for 'going' RSVPs
    if (args.status === 'going' && event.maxAttendees !== null) {
      const existing = await ctx.prisma.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: args.eventId, userId: dbUser.id } },
      });
      // Only check capacity if the user isn't already 'going'
      if (existing?.status !== 'going') {
        const goingCount = await ctx.prisma.eventAttendee.count({
          where: { eventId: args.eventId, status: 'going' },
        });
        if (goingCount >= event.maxAttendees) {
          throw new GraphQLError('This event is at capacity', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }
    }

    const rsvpStatus = args.status as EventRsvpStatus;
    const attendee = await ctx.prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: args.eventId, userId: dbUser.id } },
      create: { eventId: args.eventId, userId: dbUser.id, status: rsvpStatus },
      update: { status: rsvpStatus },
    });

    // Notify the event organizer when someone RSVPs as 'going' (skip self)
    if (args.status === 'going' && event.organizerId !== dbUser.id) {
      const rsvpUser = await ctx.prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { username: true },
      });
      if (rsvpUser) {
       createNotification(ctx.prisma, {
         userId: event.organizerId,
         type: 'community_event',
         title: '📅 New RSVP',
         body: `@${rsvpUser.username} is going to ${event.title}`,
         data: { eventId: args.eventId, communityId: event.communityId },
       }).catch(() => {});
      }    }

    return attendee;
  },

  cancelRsvp: async (
    _parent: unknown,
    args: { eventId: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const existing = await ctx.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: args.eventId, userId: dbUser.id } },
    });
    if (!existing) return false;
    await ctx.prisma.eventAttendee.delete({
      where: { eventId_userId: { eventId: args.eventId, userId: dbUser.id } },
    });
    return true;
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export const communityEventFieldResolvers = {
  organizer: (parent: CommunityEventParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({
      where: { id: parent.organizerId },
      include: { profile: true },
    });
  },

  attendeeCount: (parent: CommunityEventParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.communityEventAttendeeCount.load(parent.id);
  },

  myRsvp: async (parent: CommunityEventParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!dbUser) return null;
    return ctx.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: parent.id, userId: dbUser.id } },
    });
  },

  isFull: async (parent: CommunityEventParent, _args: unknown, ctx: Context) => {
    if (parent.maxAttendees === null) return false;
    const count = await ctx.prisma.eventAttendee.count({
      where: { eventId: parent.id, status: 'going' },
    });
    return count >= parent.maxAttendees;
  },

  startsAt: (parent: CommunityEventParent) => {
    return parent.startsAt instanceof Date
      ? parent.startsAt.toISOString()
      : parent.startsAt;
  },

  endsAt: (parent: CommunityEventParent) => {
    if (!parent.endsAt) return null;
    return parent.endsAt instanceof Date ? parent.endsAt.toISOString() : parent.endsAt;
  },

  createdAt: (parent: { createdAt: Date }) => {
    return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt;
  },

  updatedAt: (parent: { updatedAt: Date }) => {
    return parent.updatedAt instanceof Date ? parent.updatedAt.toISOString() : parent.updatedAt;
  },
};

export const eventAttendeeFieldResolvers = {
  user: (parent: EventAttendeeParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({
      where: { id: parent.userId },
      include: { profile: true },
    });
  },

  joinedAt: (parent: EventAttendeeParent) => {
    return parent.joinedAt instanceof Date ? parent.joinedAt.toISOString() : parent.joinedAt;
  },
};
