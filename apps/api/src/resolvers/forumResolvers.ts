import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ForumCategoryParent {
  id: string;
  communityId: string | null;
}

export interface ForumThreadParent {
  id: string;
  categoryId: string;
  authorId: string;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  lastPostAt: Date;
}

export interface ForumPostParent {
  id: string;
  threadId: string;
  authorId: string;
  parentPostId: string | null;
  isDeleted: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

async function getCommunityIdForCategory(categoryId: string, ctx: Context): Promise<string | null> {
  const category = await ctx.prisma.forumCategory.findUnique({
    where: { id: categoryId },
    select: { communityId: true },
  });
  if (!category) {
    throw new GraphQLError('Forum category not found', { extensions: { code: 'NOT_FOUND' } });
  }
  return category.communityId;
}

async function getCommunityIdForThread(threadId: string, ctx: Context): Promise<string | null> {
  const thread = await ctx.prisma.forumThread.findUnique({
    where: { id: threadId },
    select: { category: { select: { communityId: true } } },
  });
  if (!thread) {
    throw new GraphQLError('Forum thread not found', { extensions: { code: 'NOT_FOUND' } });
  }
  return thread.category.communityId;
}

async function getMemberRole(
  communityId: string,
  userId: string,
  ctx: Context,
): Promise<string | null> {
  const membership = await ctx.prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== 'active') return null;
  return membership.role;
}

function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

async function requireActiveMember(
  communityId: string,
  userId: string,
  ctx: Context,
): Promise<string> {
  const role = await getMemberRole(communityId, userId, ctx);
  if (!role) {
    throw new GraphQLError('You must be an active community member to do this', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return role;
}

async function requireAdmin(ctx: Context): Promise<void> {
  const dbUser = await getDbUser(ctx);
  if (!['admin', 'superuser'].includes(dbUser.role)) {
    throw new GraphQLError('Only global admins can perform this action', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const forumQueryResolvers = {
  globalForumCategories: async (_parent: unknown, _args: unknown, ctx: Context) => {
    return ctx.prisma.forumCategory.findMany({
      where: { communityId: null },
      orderBy: { position: 'asc' },
    });
  },

  forumCategories: async (
    _parent: unknown,
    args: { communityId: string },
    ctx: Context,
  ) => {
    return ctx.prisma.forumCategory.findMany({
      where: { communityId: args.communityId },
      orderBy: { position: 'asc' },
    });
  },

  forumCategory: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    return ctx.prisma.forumCategory.findUnique({ where: { id: args.id } });
  },

  forumThreads: async (
    _parent: unknown,
    args: { categoryId: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    // Pinned threads always come first, then by lastPostAt desc
    // We fetch pinned + non-pinned separately then merge
    const where: Record<string, unknown> = { categoryId: args.categoryId };
    if (args.after) {
      where.lastPostAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { lastPostAt: 'desc' }],
        take: take + 1,
      }),
      ctx.prisma.forumThread.count({ where: { categoryId: args.categoryId } }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((t) => ({
      cursor: encodeCursor(t.lastPostAt),
      node: t,
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

  forumThread: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    return ctx.prisma.forumThread.findUnique({ where: { id: args.id } });
  },

  forumPosts: async (
    _parent: unknown,
    args: { threadId: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 30, 100);
    const where: Record<string, unknown> = {
      threadId: args.threadId,
      parentPostId: null, // top-level only
    };

    if (args.after) {
      where.createdAt = { gt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.forumPost.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: take + 1,
      }),
      ctx.prisma.forumPost.count({ where: { threadId: args.threadId, parentPostId: null } }),
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
};

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const forumMutationResolvers = {
  createGlobalForumCategory: async (
    _parent: unknown,
    args: { name: string; description?: string; slug?: string },
    ctx: Context,
  ) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (!name || name.length < 2 || name.length > 80) {
      throw new GraphQLError('Category name must be 2–80 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const slug = args.slug?.trim() || slugify(name);
    if (!slug) {
      throw new GraphQLError('Could not generate a valid slug from the category name', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const existing = await ctx.prisma.forumCategory.findUnique({
      where: { communityId_slug: { communityId: null as unknown as string, slug } },
    });
    if (existing) {
      throw new GraphQLError('A global category with this slug already exists', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const position = await ctx.prisma.forumCategory.count({
      where: { communityId: null },
    });

    return ctx.prisma.forumCategory.create({
      data: {
        communityId: null,
        name,
        description: args.description?.trim() ?? null,
        slug,
        position,
      },
    });
  },

  createForumCategory: async (
    _parent: unknown,
    args: { communityId: string | null; name: string; description?: string; slug?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    if (args.communityId === null) {
      await requireAdmin(ctx);
    } else {
      const role = await getMemberRole(args.communityId, dbUser.id, ctx);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new GraphQLError('Only community owners and admins can create forum categories', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    const name = args.name.trim();
    if (!name || name.length < 2 || name.length > 80) {
      throw new GraphQLError('Category name must be 2–80 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const slug = args.slug?.trim() || slugify(name);
    if (!slug) {
      throw new GraphQLError('Could not generate a valid slug from the category name', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Check slug uniqueness within community
    const communityIdForSlug = args.communityId as string;
    const existing = await ctx.prisma.forumCategory.findUnique({
      where: { communityId_slug: { communityId: communityIdForSlug, slug } },
    });
    if (existing) {
      throw new GraphQLError('A category with this slug already exists in this community', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const position = await ctx.prisma.forumCategory.count({
      where: { communityId: communityIdForSlug },
    });

    return ctx.prisma.forumCategory.create({
      data: {
        communityId: communityIdForSlug,
        name,
        description: args.description?.trim() ?? null,
        slug,
        position,
      },
    });
  },

  updateForumCategory: async (
    _parent: unknown,
    args: { id: string; name?: string; description?: string; position?: number },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForCategory(args.id, ctx);

    if (communityId === null) {
      await requireAdmin(ctx);
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new GraphQLError('Only community owners and admins can update forum categories', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name || name.length < 2 || name.length > 80) {
        throw new GraphQLError('Category name must be 2–80 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      data.name = name;
    }
    if (args.description !== undefined) {
      data.description = args.description?.trim() ?? null;
    }
    if (args.position !== undefined) {
      data.position = args.position;
    }

    return ctx.prisma.forumCategory.update({ where: { id: args.id }, data });
  },

  deleteForumCategory: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForCategory(args.id, ctx);

    if (communityId === null) {
      await requireAdmin(ctx);
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new GraphQLError('Only community owners and admins can delete forum categories', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    await ctx.prisma.forumCategory.delete({ where: { id: args.id } });
    return true;
  },

  createForumThread: async (
    _parent: unknown,
    args: { categoryId: string; title: string; body: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForCategory(args.categoryId, ctx);

    if (communityId !== null) {
      await requireActiveMember(communityId, dbUser.id, ctx);
    }

    const title = args.title.trim();
    if (!title || title.length < 3 || title.length > 200) {
      throw new GraphQLError('Thread title must be 3–200 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const body = args.body.trim();
    if (!body || body.length < 1) {
      throw new GraphQLError('Post body cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const now = new Date();

    return ctx.prisma.$transaction(async (tx) => {
      const thread = await tx.forumThread.create({
        data: {
          categoryId: args.categoryId,
          authorId: dbUser.id,
          title,
          postCount: 1,
          lastPostAt: now,
        },
      });

      await tx.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: dbUser.id,
          body,
        },
      });

      return thread;
    });
  },

  deleteForumThread: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const thread = await ctx.prisma.forumThread.findUnique({
      where: { id: args.id },
      select: { authorId: true, category: { select: { communityId: true } } },
    });
    if (!thread) {
      throw new GraphQLError('Forum thread not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const communityId = thread.category.communityId;
    const isAuthor = thread.authorId === dbUser.id;
    const isGlobalAdmin = dbUser.role === 'admin';

    if (communityId === null) {
      if (!isAuthor && !isGlobalAdmin) {
        throw new GraphQLError('You do not have permission to delete this thread', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      const isModerator = role && roleWeight(role) >= roleWeight('moderator');
      if (!isAuthor && !isModerator) {
        throw new GraphQLError('You do not have permission to delete this thread', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    await ctx.prisma.forumThread.delete({ where: { id: args.id } });
    return true;
  },

  pinForumThread: async (
    _parent: unknown,
    args: { id: string; pinned: boolean },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForThread(args.id, ctx);

    if (communityId === null) {
      if (dbUser.role !== 'admin') {
        throw new GraphQLError('Only global admins can pin threads', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      if (!role || roleWeight(role) < roleWeight('moderator')) {
        throw new GraphQLError('Only moderators and above can pin threads', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    return ctx.prisma.forumThread.update({
      where: { id: args.id },
      data: { isPinned: args.pinned },
    });
  },

  lockForumThread: async (
    _parent: unknown,
    args: { id: string; locked: boolean },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForThread(args.id, ctx);

    if (communityId === null) {
      if (dbUser.role !== 'admin') {
        throw new GraphQLError('Only global admins can lock threads', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      if (!role || roleWeight(role) < roleWeight('moderator')) {
        throw new GraphQLError('Only moderators and above can lock threads', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    return ctx.prisma.forumThread.update({
      where: { id: args.id },
      data: { isLocked: args.locked },
    });
  },

  createForumPost: async (
    _parent: unknown,
    args: { threadId: string; body: string; parentPostId?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const communityId = await getCommunityIdForThread(args.threadId, ctx);

    if (communityId !== null) {
      await requireActiveMember(communityId, dbUser.id, ctx);
    }

    const thread = await ctx.prisma.forumThread.findUnique({
      where: { id: args.threadId },
      select: { isLocked: true },
    });
    if (!thread) {
      throw new GraphQLError('Forum thread not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (thread.isLocked) {
      throw new GraphQLError('This thread is locked and no longer accepts replies', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const body = args.body.trim();
    if (!body) {
      throw new GraphQLError('Post body cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate parentPostId belongs to same thread
    if (args.parentPostId) {
      const parent = await ctx.prisma.forumPost.findUnique({
        where: { id: args.parentPostId },
        select: { threadId: true },
      });
      if (!parent || parent.threadId !== args.threadId) {
        throw new GraphQLError('Parent post not found in this thread', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    const now = new Date();

    return ctx.prisma.$transaction(async (tx) => {
      const post = await tx.forumPost.create({
        data: {
          threadId: args.threadId,
          authorId: dbUser.id,
          body,
          parentPostId: args.parentPostId ?? null,
        },
      });

      await tx.forumThread.update({
        where: { id: args.threadId },
        data: {
          postCount: { increment: 1 },
          lastPostAt: now,
        },
      });

      return post;
    });
  },

  updateForumPost: async (
    _parent: unknown,
    args: { id: string; body: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const post = await ctx.prisma.forumPost.findUnique({
      where: { id: args.id },
      select: { authorId: true, createdAt: true },
    });
    if (!post) {
      throw new GraphQLError('Forum post not found', { extensions: { code: 'NOT_FOUND' } });
    }

    if (post.authorId !== dbUser.id) {
      throw new GraphQLError('You can only edit your own posts', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const ageMs = Date.now() - post.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (ageMs > twentyFourHours) {
      throw new GraphQLError('Posts can only be edited within 24 hours of creation', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const body = args.body.trim();
    if (!body) {
      throw new GraphQLError('Post body cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.forumPost.update({
      where: { id: args.id },
      data: { body },
    });
  },

  deleteForumPost: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const post = await ctx.prisma.forumPost.findUnique({
      where: { id: args.id },
      select: {
        authorId: true,
        thread: { select: { category: { select: { communityId: true } } } },
      },
    });
    if (!post) {
      throw new GraphQLError('Forum post not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const communityId = post.thread.category.communityId;
    const isAuthor = post.authorId === dbUser.id;
    const isGlobalAdmin = dbUser.role === 'admin';

    if (communityId === null) {
      if (!isAuthor && !isGlobalAdmin) {
        throw new GraphQLError('You do not have permission to delete this post', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      const role = await getMemberRole(communityId, dbUser.id, ctx);
      const isModerator = role && roleWeight(role) >= roleWeight('moderator');
      if (!isAuthor && !isModerator) {
        throw new GraphQLError('You do not have permission to delete this post', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    // Soft delete
    await ctx.prisma.forumPost.update({
      where: { id: args.id },
      data: { isDeleted: true, body: '[deleted]' },
    });
    return true;
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const forumCategoryFieldResolvers = {
  threadCount: (parent: ForumCategoryParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.forumCategoryThreadCount.load(parent.id);
  },

  latestThread: (parent: ForumCategoryParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.forumThread.findFirst({
      where: { categoryId: parent.id },
      orderBy: { lastPostAt: 'desc' },
    });
  },
};

export const forumThreadFieldResolvers = {
  author: (parent: ForumThreadParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.authorId } });
  },

  category: (parent: ForumThreadParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.forumCategory.findUnique({ where: { id: parent.categoryId } });
  },

  firstPost: (parent: ForumThreadParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.forumPost.findFirst({
      where: { threadId: parent.id },
      orderBy: { createdAt: 'asc' },
    });
  },
};

export const forumPostFieldResolvers = {
  author: (parent: ForumPostParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.authorId } });
  },

  replies: (parent: ForumPostParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.forumPost.findMany({
      where: { parentPostId: parent.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  },
};
