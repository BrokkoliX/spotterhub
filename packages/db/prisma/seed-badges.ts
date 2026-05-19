import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BadgeSeed {
  slug: string;
  name: string;
  description: string;
  category: 'UPLOAD' | 'ENGAGEMENT' | 'COMMUNITY' | 'STREAK' | 'DIVERSITY' | 'AWARD';
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  triggerType: 'AUTOMATIC' | 'AWARDED';
  triggerMetric?: string;
  triggerThreshold?: number;
  displayOrder: number;
}

const BADGES: BadgeSeed[] = [
  // Upload milestones
  { slug: 'spotter-bronze', name: 'Spotter', description: 'Upload your first photo', category: 'UPLOAD', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'photo_count', triggerThreshold: 1, displayOrder: 100 },
  { slug: 'spotter-silver', name: 'Spotter', description: 'Upload 10 photos', category: 'UPLOAD', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'photo_count', triggerThreshold: 10, displayOrder: 101 },
  { slug: 'spotter-gold', name: 'Spotter', description: 'Upload 100 photos', category: 'UPLOAD', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'photo_count', triggerThreshold: 100, displayOrder: 102 },
  { slug: 'spotter-platinum', name: 'Spotter', description: 'Upload 1000 photos', category: 'UPLOAD', tier: 'PLATINUM', triggerType: 'AUTOMATIC', triggerMetric: 'photo_count', triggerThreshold: 1000, displayOrder: 103 },

  // Engagement - likes received
  { slug: 'popular-bronze', name: 'Popular', description: 'Receive 10 likes on your photos', category: 'ENGAGEMENT', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'like_received_count', triggerThreshold: 10, displayOrder: 200 },
  { slug: 'popular-silver', name: 'Popular', description: 'Receive 100 likes on your photos', category: 'ENGAGEMENT', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'like_received_count', triggerThreshold: 100, displayOrder: 201 },
  { slug: 'popular-gold', name: 'Popular', description: 'Receive 500 likes on your photos', category: 'ENGAGEMENT', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'like_received_count', triggerThreshold: 500, displayOrder: 202 },
  { slug: 'popular-platinum', name: 'Popular', description: 'Receive 1000 likes on your photos', category: 'ENGAGEMENT', tier: 'PLATINUM', triggerType: 'AUTOMATIC', triggerMetric: 'like_received_count', triggerThreshold: 1000, displayOrder: 203 },

  // Engagement - comments made
  { slug: 'commentator-bronze', name: 'Commentator', description: 'Write 10 comments', category: 'ENGAGEMENT', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'comment_count', triggerThreshold: 10, displayOrder: 210 },
  { slug: 'commentator-silver', name: 'Commentator', description: 'Write 50 comments', category: 'ENGAGEMENT', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'comment_count', triggerThreshold: 50, displayOrder: 211 },
  { slug: 'commentator-gold', name: 'Commentator', description: 'Write 200 comments', category: 'ENGAGEMENT', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'comment_count', triggerThreshold: 200, displayOrder: 212 },

  // Community
  { slug: 'social-bronze', name: 'Social Spotter', description: 'Join your first community', category: 'COMMUNITY', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'community_join_count', triggerThreshold: 1, displayOrder: 300 },
  { slug: 'social-silver', name: 'Social Spotter', description: 'Join 5 communities', category: 'COMMUNITY', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'community_join_count', triggerThreshold: 5, displayOrder: 301 },
  { slug: 'social-gold', name: 'Social Spotter', description: 'Create a community', category: 'COMMUNITY', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'community_created_count', triggerThreshold: 1, displayOrder: 302 },

  // Streak
  { slug: 'streak-bronze', name: 'Dedicated', description: 'Upload photos 7 days in a row', category: 'STREAK', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'upload_streak_days', triggerThreshold: 7, displayOrder: 400 },
  { slug: 'streak-silver', name: 'Dedicated', description: 'Upload photos 30 days in a row', category: 'STREAK', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'upload_streak_days', triggerThreshold: 30, displayOrder: 401 },
  { slug: 'streak-gold', name: 'Dedicated', description: 'Upload photos 90 days in a row', category: 'STREAK', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'upload_streak_days', triggerThreshold: 90, displayOrder: 402 },

  // Diversity - airports
  { slug: 'explorer-bronze', name: 'Globe Trotter', description: 'Photograph at 5 different airports', category: 'DIVERSITY', tier: 'BRONZE', triggerType: 'AUTOMATIC', triggerMetric: 'unique_airport_count', triggerThreshold: 5, displayOrder: 500 },
  { slug: 'explorer-silver', name: 'Globe Trotter', description: 'Photograph at 25 different airports', category: 'DIVERSITY', tier: 'SILVER', triggerType: 'AUTOMATIC', triggerMetric: 'unique_airport_count', triggerThreshold: 25, displayOrder: 501 },
  { slug: 'explorer-gold', name: 'Globe Trotter', description: 'Photograph at 50 different airports', category: 'DIVERSITY', tier: 'GOLD', triggerType: 'AUTOMATIC', triggerMetric: 'unique_airport_count', triggerThreshold: 50, displayOrder: 502 },

  // Awards (manually granted)
  { slug: 'photo-of-day', name: 'Photo of the Day', description: 'Had the most liked photo of the day', category: 'AWARD', tier: 'GOLD', triggerType: 'AWARDED', displayOrder: 600 },
  { slug: 'photo-of-week', name: 'Photo of the Week', description: 'Had the most liked photo of the week', category: 'AWARD', tier: 'GOLD', triggerType: 'AWARDED', displayOrder: 601 },
  { slug: 'photo-of-month', name: 'Photo of the Month', description: 'Had the most liked photo of the month', category: 'AWARD', tier: 'PLATINUM', triggerType: 'AWARDED', displayOrder: 602 },
  { slug: 'editors-pick', name: "Editor's Pick", description: 'Selected by an editor for outstanding quality', category: 'AWARD', tier: 'GOLD', triggerType: 'AWARDED', displayOrder: 603 },
];

async function main() {
  console.log('Seeding badge definitions...');

  for (const badge of BADGES) {
    await prisma.badgeDefinition.upsert({
      where: { slug: badge.slug },
      update: {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        tier: badge.tier,
        triggerType: badge.triggerType,
        triggerMetric: badge.triggerMetric ?? null,
        triggerThreshold: badge.triggerThreshold ?? null,
        displayOrder: badge.displayOrder,
      },
      create: badge,
    });
  }

  const count = await prisma.badgeDefinition.count();
  console.log(`Done — ${count} badge definitions in database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
