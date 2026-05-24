'use client';

import { useState } from 'react';

import { PostItem, type PostData } from './PostItem';
import styles from './forum.module.css';

export interface PostWithReplies extends PostData {
  replies?: PostData[];
}

export interface PostListProps {
  posts: PostWithReplies[];
  viewer: { id: string; username: string; role: string } | null;
  isModerator: boolean;
  canReply: boolean;
  /** Username of the original thread author, used to mark the OP badge. */
  threadAuthorUsername?: string;
  onReply?: (post: PostData) => void;
  onEdit?: (post: PostData) => void;
  onDelete?: (post: PostData) => void;
  /**
   * Optional render-prop for inline edit forms. When provided and the
   * returned node is non-null for a given post id, it is rendered in place
   * of the post body. Used to host inline edit textareas.
   */
  renderEditForm?: (post: PostData) => React.ReactNode;
}

/**
 * Renders a list of forum posts with collapsible nested replies. The OP
 * (first post by the thread author) gets a subtle accent border. Replies
 * indent under their parent and can be collapsed.
 */
export function PostList({
  posts,
  viewer,
  isModerator,
  canReply,
  threadAuthorUsername,
  onReply,
  onEdit,
  onDelete,
  renderEditForm,
}: PostListProps) {
  const [collapsedReplies, setCollapsedReplies] = useState<Record<string, boolean>>({});

  const toggleReplies = (postId: string) =>
    setCollapsedReplies((prev) => ({ ...prev, [postId]: !prev[postId] }));

  return (
    <div className={styles.postList}>
      {posts.map((post, idx) => {
        const isOp = idx === 0 && post.author.username === threadAuthorUsername;
        const editForm = renderEditForm?.(post);
        return (
          <div key={post.id}>
            {editForm ?? (
              <PostItem
                post={post}
                viewer={viewer}
                isModerator={isModerator}
                canReply={canReply}
                isOp={isOp}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}

            {post.replies && post.replies.length > 0 && (
              <div className={styles.replies}>
                <button
                  type="button"
                  className={styles.repliesToggle}
                  onClick={() => toggleReplies(post.id)}
                >
                  {collapsedReplies[post.id] ? '▶' : '▼'} {post.replies.length}{' '}
                  {post.replies.length === 1 ? 'reply' : 'replies'}
                </button>
                {!collapsedReplies[post.id] &&
                  post.replies.map((reply) => {
                    const replyForm = renderEditForm?.(reply);
                    return (
                      <div key={reply.id}>
                        {replyForm ?? (
                          <PostItem
                            post={reply}
                            viewer={viewer}
                            isModerator={isModerator}
                            canReply={canReply}
                            isReply
                            onReply={onReply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
