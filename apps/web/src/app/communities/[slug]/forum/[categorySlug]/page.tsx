'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { ForumHero, ThreadComposer, ThreadList } from '@/components/forum';
import { useAuth } from '@/lib/auth';
import { CREATE_FORUM_THREAD, GET_COMMUNITY } from '@/lib/queries';
import { useForumCategoriesQuery, useForumThreadsQuery } from '@/lib/generated/graphql';

export default function CategoryPage() {
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [showNewThread, setShowNewThread] = useState(false);

  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: catData }] = useForumCategoriesQuery({
    variables: { communityId: communityData?.community?.id ?? '' },
    pause: !communityData?.community?.id,
    requestPolicy: 'cache-and-network',
  });

  const community = communityData?.community;
  const category = catData?.forumCategories?.find((c) => c.slug === categorySlug);

  const [{ data, fetching }, reexecuteQuery] = useForumThreadsQuery({
    variables: { categoryId: category?.id ?? '', first: 30 },
    pause: !category?.id,
    requestPolicy: 'cache-and-network',
  });

  const [, createThread] = useMutation(CREATE_FORUM_THREAD);

  const threads = data?.forumThreads?.edges?.map((e) => e.node) ?? [];
  const totalCount = data?.forumThreads?.totalCount;

  const isMember = !!community?.myMembership;

  if (!community) {
    return (
      <ForumHero
        title="Loading…"
        breadcrumbs={[{ label: 'Communities', href: '/communities' }, { label: '…' }]}
      />
    );
  }

  if (!category && catData) {
    return (
      <ForumHero
        title="Category not found"
        description="This forum category does not exist or has been removed."
        breadcrumbs={[
          { label: 'Communities', href: '/communities' },
          { label: community.name, href: `/communities/${slug}` },
          { label: 'Forum', href: `/communities/${slug}/forum` },
          { label: 'Not found' },
        ]}
      />
    );
  }

  const handleCreateThread = async ({ title, body }: { title: string; body: string }) => {
    if (!category) return;
    const result = await createThread({ categoryId: category.id, title, body });
    if (result.error) {
      return { error: result.error.graphQLErrors?.[0]?.message || result.error.message };
    }
    setShowNewThread(false);
    reexecuteQuery({ requestPolicy: 'network-only' });
    const newId = result.data?.createForumThread?.id;
    if (newId) {
      router.push(`/communities/${slug}/forum/${categorySlug}/${newId}`);
    }
    return { error: null };
  };

  return (
    <>
      <ForumHero
        title={category?.name ?? categorySlug}
        description={category?.description}
        breadcrumbs={[
          { label: 'Communities', href: '/communities' },
          { label: community.name, href: `/communities/${slug}` },
          { label: 'Forum', href: `/communities/${slug}/forum` },
          { label: category?.name ?? categorySlug },
        ]}
        meta={
          typeof totalCount === 'number' ? (
            <span>
              {totalCount} thread{totalCount !== 1 ? 's' : ''}
            </span>
          ) : undefined
        }
        action={
          ready && user && isMember ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewThread(true)}
            >
              + New Thread
            </button>
          ) : undefined
        }
      />

      <div className="container">
        <ThreadList
          threads={threads}
          buildHref={(t) => `/communities/${slug}/forum/${categorySlug}/${t.id}`}
          fetching={fetching}
          totalCount={totalCount}
          emptyState={
            <>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>No threads yet</div>
              <div
                style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: 440 }}
              >
                {isMember
                  ? `Be the first to start a discussion in ${category?.name ?? 'this category'}.`
                  : 'Join this community to start the first thread.'}
              </div>
              {ready && user && isMember && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowNewThread(true)}
                  style={{ marginTop: 8 }}
                >
                  Start the first thread
                </button>
              )}
            </>
          }
        />
      </div>

      {showNewThread && category && (
        <ThreadComposer
          variant="modal"
          title={`New thread in ${category.name}`}
          onSubmit={handleCreateThread}
          onCancel={() => setShowNewThread(false)}
        />
      )}
    </>
  );
}
