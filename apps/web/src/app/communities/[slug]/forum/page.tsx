'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from 'urql';

import { CommunityForumCategoryList, ForumHero } from '@/components/forum';
import { useAuth } from '@/lib/auth';
import { GET_COMMUNITY } from '@/lib/queries';
import { useForumCategoriesQuery } from '@/lib/generated/graphql';

import styles from './page.module.css';

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ForumPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, ready } = useAuth();

  const [showNewCategory, setShowNewCategory] = useState(false);

  const [{ data: communityData, fetching: communityFetching }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  // Fetch the count for the hero meta line. The shared component fetches its
  // own copy, but urql will dedupe identical operations from the cache.
  const [{ data: categoriesData }] = useForumCategoriesQuery({
    variables: { communityId: communityData?.community?.id ?? '' },
    pause: !communityData?.community?.id,
    requestPolicy: 'cache-and-network',
  });

  const community = communityData?.community;
  const categories = categoriesData?.forumCategories ?? [];

  const myRole = community?.myMembership?.role ?? null;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  if (!community && communityFetching) return <div className={styles.loading}>Loading…</div>;
  if (!community) return <div className={styles.empty}>Community not found.</div>;

  return (
    <>
      <ForumHero
        title="Forum"
        description={`Discussions in ${community.name}`}
        breadcrumbs={[
          { label: 'Communities', href: '/communities' },
          { label: community.name, href: `/communities/${slug}` },
          { label: 'Forum' },
        ]}
        meta={
          categories.length > 0 ? (
            <span>
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
            </span>
          ) : undefined
        }
        action={
          ready && user && isAdmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewCategory(true)}
            >
              + New Category
            </button>
          ) : undefined
        }
      />

      <div className={styles.page}>
        <CommunityForumCategoryList
          communityId={community.id}
          communitySlug={slug}
          isAdmin={isAdmin}
          showCreateButton={false}
          isCreateModalOpen={showNewCategory}
          onCreateModalClose={() => setShowNewCategory(false)}
        />
      </div>
    </>
  );
}
