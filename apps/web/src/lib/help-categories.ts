export interface HelpArticle {
  title: string;
  slug: string;
  href: string;
}

export interface HelpCategory {
  title: string;
  slug: string;
  description: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    description: 'Everything you need to get up and running on SpotterSpace.',
    articles: [
      {
        title: 'Creating an account',
        slug: 'create-account',
        href: '/help/getting-started/create-account',
      },
      {
        title: 'Finding photos',
        slug: 'finding-photos',
        href: '/help/getting-started/finding-photos',
      },
    ],
  },
  {
    title: 'Photos',
    slug: 'photos',
    description: 'Uploading, managing, and licensing your aviation photos.',
    articles: [
      { title: 'Uploading photos', slug: 'uploading', href: '/help/photos/uploading' },
      { title: 'Photo licenses', slug: 'licensing', href: '/help/photos/licensing' },
    ],
  },
  {
    title: 'Account',
    slug: 'account',
    description: 'Managing your profile, password, and notifications.',
    articles: [
      {
        title: 'Changing your password',
        slug: 'change-password',
        href: '/help/account/change-password',
      },
      { title: 'Notifications', slug: 'notifications', href: '/help/account/notifications' },
    ],
  },
  {
    title: 'Communities',
    slug: 'communities',
    description: 'Joining, participating in, and managing communities.',
    articles: [
      { title: 'Joining a community', slug: 'joining', href: '/help/communities/joining' },
    ],
  },
  {
    title: 'Admin & Moderation',
    slug: 'admin',
    description: 'Tools and guides for administrators and moderators.',
    articles: [
      { title: 'Moderation queue', slug: 'moderation-queue', href: '/help/admin/moderation-queue' },
    ],
  },
];
