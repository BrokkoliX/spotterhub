import type { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Loaders {
  userFollowerCount: DataLoader<string, number>;
  userFollowingCount: DataLoader<string, number>;
  userPhotoCount: DataLoader<string, number>;
  forumCategoryThreadCount: DataLoader<string, number>;
  communityMemberCount: DataLoader<string, number>;
  communityEventAttendeeCount: DataLoader<string, number>;
  photoLikeCount: DataLoader<string, number>;
  photoCommentCount: DataLoader<string, number>;
  photoLocation: DataLoader<string, any>;
  aircraftById: DataLoader<string, any>;
  aircraftTypeById: DataLoader<string, any>;
  userById: DataLoader<string, any>;
  /** Clear all loader caches — call after mutations that affect counted relationships. */
  clearAll(): void;
}

// ─── Loader Factory ─────────────────────────────────────────────────────────

/**
 * Creates a fresh set of DataLoaders for each request.
 * DataLoaders are per-request to ensure caching doesn't leak between users.
 */
export function createLoaders(prisma: PrismaClient): Loaders {
  const loaders: Loaders = {
    clearAll() {
      loaders.userFollowerCount.clearAll();
      loaders.userFollowingCount.clearAll();
      loaders.userPhotoCount.clearAll();
      loaders.forumCategoryThreadCount.clearAll();
      loaders.communityMemberCount.clearAll();
      loaders.communityEventAttendeeCount.clearAll();
      loaders.photoLikeCount.clearAll();
      loaders.photoCommentCount.clearAll();
      loaders.photoLocation.clearAll();
      loaders.aircraftById.clearAll();
      loaders.aircraftTypeById.clearAll();
      loaders.userById.clearAll();
    },

    userFollowerCount: new DataLoader(async (userIds: readonly string[]) => {
      const counts = await prisma.follow.groupBy({
        by: ['followingId'],
        where: { targetType: 'user', followingId: { in: [...userIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.followingId, c._count]));
      return userIds.map((id) => map.get(id) ?? 0);
    }),

    userFollowingCount: new DataLoader(async (userIds: readonly string[]) => {
      const counts = await prisma.follow.groupBy({
        by: ['followerId'],
        where: { targetType: 'user', followerId: { in: [...userIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.followerId, c._count]));
      return userIds.map((id) => map.get(id) ?? 0);
    }),

    userPhotoCount: new DataLoader(async (userIds: readonly string[]) => {
      const counts = await prisma.photo.groupBy({
        by: ['userId'],
        where: { userId: { in: [...userIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.userId, c._count]));
      return userIds.map((id) => map.get(id) ?? 0);
    }),

    forumCategoryThreadCount: new DataLoader(async (categoryIds: readonly string[]) => {
      const counts = await prisma.forumThread.groupBy({
        by: ['categoryId'],
        where: { categoryId: { in: [...categoryIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.categoryId, c._count]));
      return categoryIds.map((id) => map.get(id) ?? 0);
    }),

    communityMemberCount: new DataLoader(async (communityIds: readonly string[]) => {
      const counts = await prisma.communityMember.groupBy({
        by: ['communityId'],
        where: { communityId: { in: [...communityIds] }, status: 'active' },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.communityId, c._count]));
      return communityIds.map((id) => map.get(id) ?? 0);
    }),

    communityEventAttendeeCount: new DataLoader(async (eventIds: readonly string[]) => {
      const counts = await prisma.eventAttendee.groupBy({
        by: ['eventId'],
        where: { eventId: { in: [...eventIds] }, status: 'going' },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.eventId, c._count]));
      return eventIds.map((id) => map.get(id) ?? 0);
    }),

    photoLikeCount: new DataLoader(async (photoIds: readonly string[]) => {
      const counts = await prisma.like.groupBy({
        by: ['photoId'],
        where: { photoId: { in: [...photoIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.photoId, c._count]));
      return photoIds.map((id) => map.get(id) ?? 0);
    }),

    photoCommentCount: new DataLoader(async (photoIds: readonly string[]) => {
      const counts = await prisma.comment.groupBy({
        by: ['photoId'],
        where: { photoId: { in: [...photoIds] } },
        _count: true,
      });
      const map = new Map(counts.map((c) => [c.photoId, c._count]));
      return photoIds.map((id) => map.get(id) ?? 0);
    }),

    photoLocation: new DataLoader(async (photoIds: readonly string[]) => {
      const locations = await prisma.photoLocation.findMany({
        where: { photoId: { in: [...photoIds] } },
        include: {
          airport: true,
          spottingLocation: { include: { createdBy: { include: { profile: true } } } },
        },
      });
      const map = new Map(locations.map((loc) => [loc.photoId, loc]));
      return photoIds.map((id) => map.get(id) ?? null);
    }),

    aircraftById: new DataLoader(async (ids: readonly string[]) => {
      const aircraft = await prisma.aircraft.findMany({
        where: { id: { in: [...ids] } },
      });
      const map = new Map(aircraft.map((a) => [a.id, a]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    aircraftTypeById: new DataLoader(async (ids: readonly string[]) => {
      const types = await prisma.aircraftType.findMany({
        where: { id: { in: [...ids] } },
      });
      const map = new Map(types.map((t) => [t.id, t]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    userById: new DataLoader(async (ids: readonly string[]) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } },
        include: { profile: true },
      });
      const map = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => map.get(id) ?? null);
    }),
  };
  return loaders;
}
