'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { AWARD_BADGE, GET_BADGE_DEFINITIONS, REVOKE_BADGE } from '@/lib/queries';

const ADMIN_CHOICE_SLUG = 'AChoice';

interface BadgeDef {
  id: string;
  slug: string;
  name: string;
  tier: string;
  isActive: boolean;
  isRepeatable: boolean;
}

interface AwardedBadgeRef {
  id: string;
  badgeDefinition?: { slug?: string } | null;
}

/**
 * Admin-or-superuser one-click button that awards or revokes the
 * `AChoice` badge for a specific photo. The button toggles state
 * based on whether the photo already carries the badge.
 *
 * The button is intentionally hidden (rather than disabled) when the badge
 * definition is missing or inactive, since neither action would succeed.
 */
export function AdminChoiceButton({
  photoId,
  uploaderId,
  uploaderUsername,
  awardedBadges,
}: {
  photoId: string;
  uploaderId: string;
  uploaderUsername: string;
  awardedBadges?: AwardedBadgeRef[] | null;
}) {
  const [{ data, fetching: loadingDefs }] = useQuery({
    query: GET_BADGE_DEFINITIONS,
    variables: { isActive: true },
  });
  const [{ fetching: awarding }, awardBadge] = useMutation(AWARD_BADGE);
  const [{ fetching: revoking }, revokeBadge] = useMutation(REVOKE_BADGE);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const adminChoice: BadgeDef | undefined = data?.badgeDefinitions?.find(
    (b: BadgeDef) => b.slug === ADMIN_CHOICE_SLUG && b.isActive,
  );

  // Find an existing AChoice row for THIS photo. repeatable badges like
  // Admin's Choice have one row per photo, so we need the userBadgeId to
  // revoke precisely (a non-specific revoke would nuke the user's other
  // Admin's Choice awards on different photos).
  const existing = awardedBadges?.find((b) => b.badgeDefinition?.slug === ADMIN_CHOICE_SLUG);
  const isAwarded = !!existing;
  const busy = awarding || revoking;

  if (loadingDefs) return null;
  if (!adminChoice) return null;

  const handleClick = async () => {
    setFeedback(null);

    if (isAwarded) {
      if (!confirm(`Remove "${adminChoice.name}" from @${uploaderUsername} for this photo?`)) {
        return;
      }
      const result = await revokeBadge({
        userId: uploaderId,
        badgeDefinitionId: adminChoice.id,
        userBadgeId: existing!.id,
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
        message: `Removed "${adminChoice.name}" from @${uploaderUsername}.`,
      });
      return;
    }

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
        disabled={busy}
        style={{
          background: isAwarded ? 'var(--color-danger, #c33)' : 'var(--color-accent, #2a7)',
          color: '#fff',
          padding: '6px 12px',
          fontSize: '0.875rem',
        }}
      >
        {busy
          ? isAwarded
            ? 'Removing…'
            : 'Awarding…'
          : isAwarded
            ? `Remove "${adminChoice.name}"`
            : `Award "${adminChoice.name}"`}
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
