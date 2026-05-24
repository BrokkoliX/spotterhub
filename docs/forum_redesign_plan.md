# Forum Redesign Plan

## Context

SpotterHub has two parallel forum implementations: a global forum at `/forum` and a community-scoped forum at `/communities/[slug]/forum`. The category-listing pages (forum index) look acceptable, but the **threads-in-a-category view looks broken**, particularly for the global forum.

## Root Cause of the Current Problem

The page at `apps/web/src/app/forum/[slug]/page.tsx` (the page rendered when a user clicks into a forum category to see its threads) imports `../../page.module.css` and references the following class names: `threadList`, `threadRow`, `threadIcon`, `threadBody`, `threadTitleRow`, `threadTitle`, `threadMeta`, `threadPreview`, `threadStats`, `threadPostCount`, `breadcrumb`, `header`, `heroTitle`, `heroSubtitle`, `badge`, `badgePinned`, `badgeLocked`. None of these classes exist in `apps/web/src/app/forum/page.module.css`. The result is an unstyled list of `<a>` tags, which is what the user is seeing.

The community-scoped equivalent at `apps/web/src/app/communities/[slug]/forum/[categorySlug]/page.tsx` does have matching CSS, but it uses a dated phpBB-style row layout (icon, title with truncation, post-count column on the right) that does not align with the rest of the application, which favors generously spaced cards with hero banners, soft accent gradients, and an avatar-led metadata row.

## Design Goals

The redesign must align with the existing design system in `apps/web/src/app/globals.css`. Key tokens are `--color-bg`, `--color-bg-card`, `--color-bg-raised`, `--color-border`, `--color-accent`, `--color-accent-soft`, `--radius-md`, `--radius-lg`, `--shadow-card`, and the `--space-*` scale. The redesign must support both dark (default) and light themes through these tokens, never hard-coded colors. It must remain fully responsive, with cards collapsing gracefully below the `--bp-md` (768px) breakpoint. Visual consistency with the photo feed, community cards, and event cards is the target.

## Proposed Visual Direction

The category-threads page should feel like a curated discussion feed rather than a tabular list. Each thread becomes a card with three visual zones: a left-side author avatar block, a centre content block with title, badges, and a short snippet of the first post, and a right-side activity block showing reply count, last reply author, and a relative timestamp. On mobile, the right-side block collapses below the content block.

The category header gets a compact hero treatment using the same gradient pattern already established on the global forum index (`linear-gradient(135deg, #0a0a1a 0%, #0f1f3d 40%, #1a2d5a 70%, #0f3460 100%)` with the accent radial overlay), but at reduced height (around 140px) so the threads remain the primary content. The hero contains the category name, description, thread count, and a primary `New Thread` button.

A sticky toolbar sits between the hero and the thread list, containing sort controls (`Latest activity`, `Newest`, `Most replies`), a filter for `Pinned only` / `Unanswered`, and a search input scoped to the category. Pinned threads render in a separate group at the top with a subtle accent-soft background.

Empty and loading states use centered card panels rather than plain text, matching the style already used on the events and communities pages.

## Component Architecture

The current duplication between `/forum` and `/communities/[slug]/forum` is the underlying maintenance problem and must be resolved as part of this work. The redesign extracts a shared component set under `apps/web/src/components/forum/`:

The `ForumHero` component renders the gradient hero with title, description, breadcrumbs, and a primary action slot. The `ThreadCard` component renders a single thread row in the new card design and accepts a `linkHref` prop so it can be reused by both the global and community forum routes. The `ThreadList` component handles grouping (pinned vs. regular), empty state, loading skeletons, and pagination. The `ThreadComposer` component replaces the duplicated `NewThreadModal` and `NewThreadForm`. The `PostItem` and `PostList` components consolidate the post-rendering logic that currently lives in both `forum/[slug]/[threadId]/page.tsx` and `communities/[slug]/forum/[categorySlug]/[threadId]/page.tsx`.

A single `forum.module.css` co-located in `apps/web/src/components/forum/` owns all forum-specific styles. The two route-level `page.module.css` files are reduced to layout-only concerns or removed entirely.

## Markup Sketch for the Thread Card

The new thread card uses semantic structure that maps cleanly to the design tokens. The skeleton looks like the following:

```tsx
<Link href={linkHref} className={styles.threadCard}>
  <div className={styles.threadAuthor}>
    <Avatar user={thread.author} size="md" />
  </div>
  <div className={styles.threadContent}>
    <div className={styles.threadTitleRow}>
      {thread.isPinned && <Badge variant="pinned">Pinned</Badge>}
      {thread.isLocked && <Badge variant="locked">Locked</Badge>}
      <h3 className={styles.threadTitle}>{thread.title}</h3>
    </div>
    <p className={styles.threadSnippet}>{snippet}</p>
    <div className={styles.threadByline}>
      <span>{authorLabel}</span>
      <span aria-hidden>·</span>
      <time dateTime={thread.createdAt}>{formatRelative(thread.createdAt)}</time>
    </div>
  </div>
  <div className={styles.threadActivity}>
    <div className={styles.threadReplyCount}>{thread.postCount}</div>
    <div className={styles.threadReplyLabel}>replies</div>
    <div className={styles.threadLastActivity}>
      <Avatar user={thread.lastPostAuthor} size="sm" />
      <time dateTime={thread.lastPostAt}>{formatRelative(thread.lastPostAt)}</time>
    </div>
  </div>
</Link>
```

This will use the design tokens from `globals.css`, so `.threadCard` resolves to `background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-5); transition: border-color 0.15s, transform 0.15s;` and the hover state uses `border-color: var(--color-accent); transform: translateY(-1px); box-shadow: var(--shadow-card);`.

## CSS Conventions

Each card uses `var(--radius-md)` (10px) rather than the current `var(--radius-sm)` (6px), which is the convention now used across photo cards, community cards, and event cards. Spacing inside cards uses `var(--space-5)` (20px) on desktop and `var(--space-4)` (16px) below `--bp-md`. Title typography is `font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.01em;`. Snippet typography is `font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5;` and is clamped to two lines using `-webkit-line-clamp: 2`.

Badges are restyled to match the existing `.tag` utility in `globals.css` (pill shape, `var(--color-accent-soft)` background) with two variants. The pinned variant uses the accent colors. The locked variant uses a muted token-based style: `background: color-mix(in srgb, var(--color-text-muted) 15%, transparent); color: var(--color-text-secondary);`.

## Mobile Behavior

Below `--bp-md` (768px), the thread card switches from a three-column flex layout to a vertical stack. The author avatar moves inline with the byline, and the activity block collapses to a single line at the bottom of the card showing `N replies · Last activity 2h ago`. The hero reduces to 100px height and drops the description in favor of a tooltip on long-press.

## Migration Strategy

The work should proceed in four self-contained, individually shippable steps:

Step one introduces the shared `apps/web/src/components/forum/` directory with `ThreadCard`, `ThreadList`, and the corresponding `forum.module.css`, plus Storybook-style ad-hoc rendering on a scratch route to verify the visuals against real data.

Step two migrates the **global** category-threads page (`apps/web/src/app/forum/[slug]/page.tsx`) to use the new components. This step alone fixes the broken-looking page that triggered this plan.

Step three migrates the **community-scoped** category-threads page and the global forum index hero to share `ForumHero`. The community forum index gets the same hero treatment so the entry into a community forum feels as polished as the global one.

Step four extracts `PostItem`, `PostList`, and `ThreadComposer` to consolidate the thread-detail pages, deleting the duplicated logic in both route files.

## Out of Scope

Real-time updates via subscriptions, rich-text editing in the composer, thread tagging, and reactions on posts are explicitly deferred. The existing GraphQL schema and resolvers are not modified by this redesign; the work is purely presentational and structural on the web client.

## Validation Checklist

After implementation, the following must be true. The threads view at `/forum/[slug]` renders with full styling and matches the visual weight of the global forum index hero. The threads view at `/communities/[slug]/forum/[categorySlug]` uses the same `ThreadCard` component and is visually indistinguishable from the global threads view aside from the breadcrumb and category context. Both light and dark themes render correctly without any hard-coded colors. Mobile layout below 768px collapses cleanly with no horizontal scroll. The existing Playwright specs `e2e/communities.spec.ts` and any forum-related coverage continue to pass, and a new spec is added covering the redesigned thread card hover, badge rendering, and pinned/regular grouping.
