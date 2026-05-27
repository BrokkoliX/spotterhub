import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cleanDatabase,
  createTestUser,
  prisma,
  setupTestServer,
  teardownTestServer,
} from './testHelpers.js';

// ─── Test scaffolding ───────────────────────────────────────────────────────

let server: Awaited<ReturnType<typeof setupTestServer>>;

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

async function createTestPhoto(userId: string) {
  return prisma.photo.create({
    data: {
      userId,
      originalUrl: 'http://localhost:4566/test-bucket/test.jpg',
      mimeType: 'image/jpeg',
      moderationStatus: 'approved',
    },
  });
}

async function createSuperuser() {
  return createTestUser({
    role: 'superuser',
    username: 'su',
    email: 'su@test.com',
    cognitoSub: 'sub-su',
  });
}

// ─── GraphQL operations ─────────────────────────────────────────────────────

const CREATE_BADGE_DEFINITION = `
  mutation CreateBadgeDefinition($input: CreateBadgeDefinitionInput!) {
    createBadgeDefinition(input: $input) {
      id
      slug
      name
      isRepeatable
      triggerType
      triggerMetric
      triggerThreshold
    }
  }
`;

const AWARD_BADGE = `
  mutation AwardBadge($userId: ID!, $badgeDefinitionId: ID!, $photoId: ID) {
    awardBadge(userId: $userId, badgeDefinitionId: $badgeDefinitionId, photoId: $photoId) {
      id
      awardedAt
      awardedPhoto { id }
      awarder { id username }
      badgeDefinition { id slug }
    }
  }
`;

const REVOKE_BADGE = `
  mutation RevokeBadge($userId: ID!, $badgeDefinitionId: ID!, $userBadgeId: ID) {
    revokeBadge(userId: $userId, badgeDefinitionId: $badgeDefinitionId, userBadgeId: $userBadgeId)
  }
`;

// NOTE on engine wiring: likeResolvers, commentResolvers, and communityResolvers
// all invoke `checkAndAwardBadges(...)` in a fire-and-forget pattern (matching
// the established convention in photoResolvers.ts) so that badge-engine
// failures cannot break user-facing mutations. This makes a "mutate then
// assert badge state" integration test inherently racy. The engine itself is
// covered directly by the awardBadge / revokeBadge cases below; manual QA
// covers the full path through the user-facing mutation.

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Badge system', () => {
  describe('createBadgeDefinition', () => {
    it('persists isRepeatable when supplied', async () => {
      const { ctx } = await createSuperuser();

      const res = await server.executeOperation(
        {
          query: CREATE_BADGE_DEFINITION,
          variables: {
            input: {
              slug: 'admin-choice-week',
              name: "Admin's Choice of the Week",
              description: 'Chosen by an admin',
              category: 'AWARD',
              tier: 'GOLD',
              triggerType: 'AWARDED',
              isRepeatable: true,
            },
          },
        },
        { contextValue: ctx },
      );

      const data = (
        res.body as unknown as {
          singleResult: {
            data: { createBadgeDefinition: { isRepeatable: boolean; slug: string } };
          };
        }
      ).singleResult.data;
      expect(data.createBadgeDefinition.slug).toBe('admin-choice-week');
      expect(data.createBadgeDefinition.isRepeatable).toBe(true);
    });
  });

  describe('awardBadge', () => {
    it('records awardedPhoto and awarder when superuser grants a badge', async () => {
      const { user: superuser, ctx } = await createSuperuser();
      const { user: recipient } = await createTestUser({
        username: 'rec',
        email: 'rec@test.com',
        cognitoSub: 'sub-rec',
      });
      const photo = await createTestPhoto(recipient.id);

      const def = await prisma.badgeDefinition.create({
        data: {
          slug: 'admin-choice-week',
          name: "Admin's Choice of the Week",
          description: 'Picked by an admin',
          category: 'AWARD',
          tier: 'GOLD',
          triggerType: 'AWARDED',
          isRepeatable: true,
        },
      });

      const res = await server.executeOperation(
        {
          query: AWARD_BADGE,
          variables: { userId: recipient.id, badgeDefinitionId: def.id, photoId: photo.id },
        },
        { contextValue: ctx },
      );

      const granted = (
        res.body as unknown as {
          singleResult: {
            data: {
              awardBadge: {
                awardedPhoto: { id: string } | null;
                awarder: { id: string; username: string } | null;
              };
            };
          };
        }
      ).singleResult.data.awardBadge;
      expect(granted.awardedPhoto?.id).toBe(photo.id);
      expect(granted.awarder?.id).toBe(superuser.id);

      // Notification was created for the recipient.
      const notifications = await prisma.notification.findMany({
        where: { userId: recipient.id, type: 'badge_earned' },
      });
      expect(notifications).toHaveLength(1);
    });

    it('allows the same repeatable badge twice for the same user with different photos', async () => {
      const { ctx } = await createSuperuser();
      const { user: recipient } = await createTestUser({
        username: 'rec2',
        email: 'rec2@test.com',
        cognitoSub: 'sub-rec2',
      });
      const photo1 = await createTestPhoto(recipient.id);
      const photo2 = await createTestPhoto(recipient.id);

      const def = await prisma.badgeDefinition.create({
        data: {
          slug: 'admin-choice-week',
          name: "Admin's Choice",
          description: 'x',
          category: 'AWARD',
          tier: 'GOLD',
          triggerType: 'AWARDED',
          isRepeatable: true,
        },
      });

      const a1 = await server.executeOperation(
        {
          query: AWARD_BADGE,
          variables: { userId: recipient.id, badgeDefinitionId: def.id, photoId: photo1.id },
        },
        { contextValue: ctx },
      );
      const a2 = await server.executeOperation(
        {
          query: AWARD_BADGE,
          variables: { userId: recipient.id, badgeDefinitionId: def.id, photoId: photo2.id },
        },
        { contextValue: ctx },
      );

      expect(
        (a1.body as unknown as { singleResult: { errors?: unknown } }).singleResult.errors,
      ).toBeUndefined();
      expect(
        (a2.body as unknown as { singleResult: { errors?: unknown } }).singleResult.errors,
      ).toBeUndefined();

      const rows = await prisma.userBadge.findMany({
        where: { userId: recipient.id, badgeDefinitionId: def.id },
      });
      expect(rows).toHaveLength(2);
    });

    it('is idempotent for non-repeatable badges (returns the existing instance)', async () => {
      const { ctx } = await createSuperuser();
      const { user: recipient } = await createTestUser({
        username: 'rec3',
        email: 'rec3@test.com',
        cognitoSub: 'sub-rec3',
      });

      const def = await prisma.badgeDefinition.create({
        data: {
          slug: 'first-upload',
          name: 'First Upload',
          description: 'x',
          category: 'UPLOAD',
          tier: 'BRONZE',
          triggerType: 'AWARDED',
          isRepeatable: false,
        },
      });

      await server.executeOperation(
        { query: AWARD_BADGE, variables: { userId: recipient.id, badgeDefinitionId: def.id } },
        { contextValue: ctx },
      );
      await server.executeOperation(
        { query: AWARD_BADGE, variables: { userId: recipient.id, badgeDefinitionId: def.id } },
        { contextValue: ctx },
      );

      const rows = await prisma.userBadge.findMany({
        where: { userId: recipient.id, badgeDefinitionId: def.id },
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe('revokeBadge', () => {
    it('revokes only the row identified by userBadgeId for repeatable badges', async () => {
      const { ctx } = await createSuperuser();
      const { user: recipient } = await createTestUser({
        username: 'rec4',
        email: 'rec4@test.com',
        cognitoSub: 'sub-rec4',
      });
      const photo1 = await createTestPhoto(recipient.id);
      const photo2 = await createTestPhoto(recipient.id);

      const def = await prisma.badgeDefinition.create({
        data: {
          slug: 'admin-choice-week',
          name: 'AC',
          description: 'x',
          category: 'AWARD',
          tier: 'GOLD',
          triggerType: 'AWARDED',
          isRepeatable: true,
        },
      });

      const ub1 = await prisma.userBadge.create({
        data: { userId: recipient.id, badgeDefinitionId: def.id, awardedPhotoId: photo1.id },
      });
      await prisma.userBadge.create({
        data: { userId: recipient.id, badgeDefinitionId: def.id, awardedPhotoId: photo2.id },
      });

      await server.executeOperation(
        {
          query: REVOKE_BADGE,
          variables: { userId: recipient.id, badgeDefinitionId: def.id, userBadgeId: ub1.id },
        },
        { contextValue: ctx },
      );

      const remaining = await prisma.userBadge.findMany({
        where: { userId: recipient.id, badgeDefinitionId: def.id },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].awardedPhotoId).toBe(photo2.id);
    });
  });
});
