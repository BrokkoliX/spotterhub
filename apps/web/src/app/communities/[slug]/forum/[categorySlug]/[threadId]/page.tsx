'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import {
  ForumHero,
  PostList,
  ReplyComposer,
  type PostData,
  type PostWithReplies,
} from '@/components/forum';
import { useAuth } from '@/lib/auth';
import {
  CREATE_FORUM_POST,
  DELETE_FORUM_POST,
  GET_COMMUNITY,
  LOCK_FORUM_THREAD,
  PIN_FORUM_THREAD,
  UPDATE_FORUM_POST,
} from '@/lib/queries';
import { useForumPostsQuery, useForumThreadQuery } from '@/lib/generated/graphql';

import forumStyles from '@/components/forum/forum.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function authorLabel(
  author: { username: string; profile?: { displayName?: string | null } | null } | null | undefined,
): string {
  return author?.profile?.displayName?.trim() || author?.username || 'Unknown';
}

export default function ThreadPage() {
  const { slug, categorySlug, threadId } = useParams<{
    slug: string;
    categorySlug: string;
    threadId: string;
  }>();
  const { user, ready } = useAuth();

  // Reply / edit state
  const [replyTo, setReplyTo] = useState<{ postId: string; authorName: string } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Queries
  const [{ data: communityData }] = useQuery({
    query: GET_COMMUNITY,
    variables: { slug },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: threadData, fetching: threadFetching }] = useForumThreadQuery({
    variables: { id: threadId },
    requestPolicy: 'cache-and-network',
  });

  const [{ data: postsData, fetching: postsFetching }, reexecutePosts] = useForumPostsQuery({
    variables: { threadId, first: 50 },
    requestPolicy: 'cache-and-network',
  });

  // Mutations
  const [, createPost] = useMutation(CREATE_FORUM_POST);
  const [, updatePost] = useMutation(UPDATE_FORUM_POST);
  const [, deletePost] = useMutation(DELETE_FORUM_POST);
  const [, pinThread] = useMutation(PIN_FORUM_THREAD);
  const [, lockThread] = useMutation(LOCK_FORUM_THREAD);

  const community = communityData?.community;
  const thread = threadData?.forumThread;
  const posts: PostWithReplies[] = (postsData?.forumPosts?.edges?.map((e) => e.node) ??
    []) as PostWithReplies[];
  const totalPosts = postsData?.forumPosts?.totalCount ?? 0;

  const myRole = community?.myMembership?.role ?? null;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isModerator = isAdmin || myRole === 'moderator';
  const isMember = !!community?.myMembership;
  const isLocked = thread?.isLocked ?? false;

  const refreshPosts = () => reexecutePosts({ requestPolicy: 'network-only' });

  if (threadFetching && !thread) {
    return (
      <ForumHero
        title="Loading thread…"
        breadcrumbs={[{ label: 'Communities', href: '/communities' }, { label: '…' }]}
      />
    );
  }

  if (!thread) {
    return (
      <ForumHero
        title="Thread not found"
        description="This thread may have been removed or never existed."
        breadcrumbs={[
          { label: 'Communities', href: '/communities' },
          { label: community?.name ?? slug, href: `/communities/${slug}` },
          { label: 'Forum', href: `/communities/${slug}/forum` },
          { label: 'Not found' },
        ]}
      />
    );
  }

  // ── Reply submit ──
  const handleReplySubmit = async (body: string) => {
    if (!body) return { error: 'Reply cannot be empty' };
    const result = await createPost({
      threadId,
      body,
      parentPostId: replyTo?.postId ?? undefined,
    });
    if (result.error) {
      return { error: result.error.graphQLErrors?.[0]?.message || result.error.message };
    }
    setReplyTo(null);
    refreshPosts();
    return { error: null };
  };

  // ── Edit submit ──
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostId) return;
    setEditError(null);
    setEditSubmitting(true);
    const result = await updatePost({ id: editingPostId, body: editBody.trim() });
    setEditSubmitting(false);
    if (result.error) {
      setEditError(result.error.graphQLErrors?.[0]?.message || result.error.message);
    } else {
      setEditingPostId(null);
      setEditBody('');
      refreshPosts();
    }
  };

  const handleDelete = async (post: PostData) => {
    if (!confirm('Delete this post?')) return;
    await deletePost({ id: post.id });
    refreshPosts();
  };

  const handleStartReply = (post: PostData) => {
    setReplyTo({ postId: post.id, authorName: authorLabel(post.author) });
    document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartEdit = (post: PostData) => {
    setEditingPostId(post.id);
    setEditBody(post.body);
    setEditError(null);
  };

  const handlePin = async () => {
    await pinThread({ id: thread.id, pinned: !thread.isPinned });
  };

  const handleLock = async () => {
    await lockThread({ id: thread.id, locked: !thread.isLocked });
  };

  // Inline edit form rendered in place of the post body when editing.
  const renderEditForm = (post: PostData) => {
    if (editingPostId !== post.id) return null;
    return (
      <article className={forumStyles.post}>
        <header className={forumStyles.postHeader}>
          <div className={forumStyles.postAvatar} aria-hidden="true">
            {authorLabel(post.author).charAt(0).toUpperCase()}
          </div>
          <div className={forumStyles.postAuthorBlock}>
            <div className={forumStyles.postAuthorName}>{authorLabel(post.author)}</div>
            <div className={forumStyles.postDate}>Editing…</div>
          </div>
        </header>
        <form
          onSubmit={handleEditSubmit}
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <textarea
            className={forumStyles.composerTextarea}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            required
            autoFocus
            aria-label="Edit post body"
          />
          {editError && <div className={forumStyles.composerError}>{editError}</div>}
          <div className={forumStyles.composerActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditingPostId(null);
                setEditBody('');
                setEditError(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </article>
    );
  };

  return (
    <>
      <ForumHero
        title={thread.title}
        breadcrumbs={[
          { label: 'Communities', href: '/communities' },
          { label: community?.name ?? slug, href: `/communities/${slug}` },
          { label: 'Forum', href: `/communities/${slug}/forum` },
          {
            label: thread.category?.name ?? categorySlug,
            href: `/communities/${slug}/forum/${categorySlug}`,
          },
          {
            label: thread.title.length > 40 ? `${thread.title.slice(0, 40)}…` : thread.title,
          },
        ]}
        meta={
          <>
            <span>by {authorLabel(thread.author)}</span>
            <span>{formatDate(thread.createdAt)}</span>
            <span>
              {totalPosts} post{totalPosts !== 1 ? 's' : ''}
            </span>
            {thread.isPinned && (
              <span className={`${forumStyles.badge} ${forumStyles.badgePinned}`}>Pinned</span>
            )}
            {thread.isLocked && (
              <span className={`${forumStyles.badge} ${forumStyles.badgeLocked}`}>Locked</span>
            )}
          </>
        }
        action={
          isModerator ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePin}
                style={{ fontSize: '0.8125rem' }}
              >
                {thread.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLock}
                style={{ fontSize: '0.8125rem' }}
              >
                {thread.isLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          ) : undefined
        }
      />

      <div
        className="container"
        style={{
          paddingTop: 24,
          paddingBottom: 48,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {postsFetching && posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
            Loading posts…
          </div>
        )}

        {posts.length > 0 && (
          <PostList
            posts={posts}
            viewer={user ? { id: user.id, username: user.username, role: user.role } : null}
            isModerator={isModerator}
            canReply={isMember && !isLocked}
            threadAuthorUsername={thread.author?.username}
            onReply={handleStartReply}
            onEdit={handleStartEdit}
            onDelete={handleDelete}
            renderEditForm={renderEditForm}
          />
        )}

        {ready && user && isMember ? (
          <ReplyComposer
            onSubmit={handleReplySubmit}
            replyingTo={replyTo ? { authorName: replyTo.authorName } : null}
            onCancelReply={() => setReplyTo(null)}
            isLocked={isLocked}
          />
        ) : (
          <ReplyComposer
            onSubmit={async () => ({ error: 'Sign in to reply' })}
            isLocked={isLocked}
            isAnonymous={ready && !user}
          />
        )}
      </div>
    </>
  );
}
