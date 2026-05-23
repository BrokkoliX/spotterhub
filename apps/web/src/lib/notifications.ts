// ─── Shared notification helpers ──────────────────────────────────────────────
// Shared between the header NotificationBell dropdown and the /notifications
// inbox page so both routing and time-formatting stay in lock-step.

/**
 * Format a relative time string (e.g. "5m ago") suitable for compact UIs.
 * Falls back to absolute date for events older than ~7 days because relative
 * counts past a week are noisy ("32d ago") and rarely actionable.
 */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

/**
 * Compute the destination URL for a notification's "view" action, derived
 * from the JSON `data` payload set by the server-side notification creator.
 */
export function notificationHref(data: Record<string, unknown> | null): string {
  if (!data) return '/';
  if (data.photoId) return `/photos/${data.photoId}`;
  if (data.communityId) return `/communities`;
  if (data.marketplaceItemId) return `/marketplace/${data.marketplaceItemId}`;
  return '/';
}

/**
 * Human-readable label for the notification type enum. Used by the inbox
 * page when it renders a small "type" pill next to each notification.
 */
export function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'like':
      return 'Like';
    case 'comment':
      return 'Comment';
    case 'follow':
      return 'Follow';
    case 'mention':
      return 'Mention';
    case 'moderation':
      return 'Moderation';
    case 'system':
      return 'System';
    case 'community_join':
      return 'Community';
    case 'community_event':
      return 'Event';
    default:
      return type;
  }
}
