'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from 'urql';

import { ForumHero, ThreadComposer, ThreadList } from '@/components/forum';
import { useAuth } from '@/lib/auth';
import { CREATE_FORUM_THREAD } from '@/lib/queries';
import { useGlobalForumCategoriesQuery, useForumThreadsQuery } from '@/lib/generated/graphql';

export default function GlobalForumCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [showNewThread, setShowNewThread] = useState(false);

  const [{ data: catData, fetching: catFetching }] = useGlobalForumCategoriesQuery({
    requestPolicy: 'cache-and-network',
  });

  const categories = catData?.globalForumCategories ?? [];
  const category = categories.find((c) => c.slug === slug);

  const [{ data: threadData, fetching: threadFetching }, refreshThreads] = useForumThreadsQuery({
    variables: { categoryId: category?.id ?? '', first: 30 },
    pause: !category?.id,
    requestPolicy: 'cache-and-network',
  });

  const [, createThread] = useMutation(CREATE_FORUM_THREAD);

  const threads = threadData?.forumThreads?.edges?.map((e) => e.node) ?? [];
  const totalCount = threadData?.forumThreads?.totalCount;

  if (catFetching && !category) {
    return (
      <ForumHero
        title="Loading…"
        breadcrumbs={[{ label: 'Forum', href: '/forum' }, { label: '…' }]}
      />
    );
  }

  if (!category) {
    return (
      <ForumHero
        title="Category not found"
        description="This forum category does not exist or has been removed."
        breadcrumbs={[{ label: 'Forum', href: '/forum' }, { label: 'Not found' }]}
      />
    );
  }

  const handleCreateThread = async ({ title, body }: { title: string; body: string }) => {
    const result = await createThread({ categoryId: category.id, title, body });
    if (result.error) {
      return { error: result.error.graphQLErrors?.[0]?.message || result.error.message };
    }
    setShowNewThread(false);
    refreshThreads({ requestPolicy: 'network-only' });
    const newId = result.data?.createForumThread?.id;
    if (newId) {
      router.push(`/forum/${slug}/${newId}`);
    }
    return { error: null };
  };

  return (
    <>
      <ForumHero
        title={category.name}
        description={category.description}
        breadcrumbs={[{ label: 'Forum', href: '/forum' }, { label: category.name }]}
        meta={
          <>
            <span>
              {category.threadCount} thread{category.threadCount !== 1 ? 's' : ''}
            </span>
          </>
        }
        action={
          ready && user ? (
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
          buildHref={(t) => `/forum/${slug}/${t.id}`}
          fetching={threadFetching}
          totalCount={totalCount}
          emptyState={
            <>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>No threads yet</div>
              <div
                style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: 440 }}
              >
                Be the first to start a discussion in {category.name}.
              </div>
              {ready && user && (
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

      {showNewThread && (
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
