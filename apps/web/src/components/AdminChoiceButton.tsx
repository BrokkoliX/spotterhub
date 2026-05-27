'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { AWARD_BADGE, GET_BADGE_DEFINITIONS } from '@/lib/queries';

const ADMIN_CHOICE_SLUG = 'admin-choice-week';

interface BadgeDef {
  id: string;
  slug: string;
  name: string;
  tier: string;
  isActive: boolean;
  isRepeatable: boolean;
}

/**
 * Superuser-only one-click button that awards the `admin-choice-week` badge
 * to a photo's uploader, recording the photo as the basis for the award.
 *
 * The button is intentionally hidden (rather than disabled) when the badge
 * definition is missing or inactive, since this action would never succeed.
 */
export function AdminChoiceButton({
  photoId,
  uploaderId,
  uploaderUsername,
}: {
  photoId: string;
  uploaderId: string;
  uploaderUsername: string;
}) {
  const [{ data, fetching: loadingDefs }] = useQuery({
    query: GET_BADGE_DEFINITIONS,
    variables: { isActive: true },
  });
  const [{ fetching: awarding }, awardBadge] = useMutation(AWARD_BADGE);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const adminChoice: BadgeDef | undefined = data?.badgeDefinitions?.find(
    (b: BadgeDef) => b.slug === ADMIN_CHOICE_SLUG && b.isActive,
  );

  if (loadingDefs) return null;
  if (!adminChoice) return null;

  const handleClick = async () => {
    setFeedback(null);
    const repeatableNote = adminChoice.isRepeatable
      ? '\n\nThis user can earn this badge again on a future photo.'
      : '';
    if (
      !confirm(
        `Award "${adminChoice.name}" to @${uploaderUsername} for this photo?${repeatableNote}`,
      )
    ) {
      return;
    }

    const result = await awardBadge({
      badgeDefinitionId: adminChoice.id,
      userId: uploaderId,
      photoId,
    });

    if (result.error) {
      setFeedback({
        kind: 'err',
        message: result.error.graphQLErrors?.[0]?.message ?? result.error.message,
      });
      return;
    }

    setFeedback({
      kind: 'ok',
      message: `Awarded "${adminChoice.name}" to @${uploaderUsername}.`,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        margin: '12px 0',
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>🏆 Admin tools</span>
      <button
        type="button"
        className="btn"
        onClick={handleClick}
        disabled={awarding}
        style={{
          background: 'var(--color-accent, #2a7)',
          color: '#fff',
          padding: '6px 12px',
          fontSize: '0.875rem',
        }}
      >
        {awarding ? 'Awarding…' : `Award "${adminChoice.name}"`}
      </button>
      {feedback && (
        <span
          style={{
            fontSize: '0.8125rem',
            color:
              feedback.kind === 'ok' ? 'var(--color-success, #2a7)' : 'var(--color-danger, #c33)',
          }}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
