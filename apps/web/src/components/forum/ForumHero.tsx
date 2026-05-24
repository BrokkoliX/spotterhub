'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './forum.module.css';

export interface ForumHeroBreadcrumbItem {
  label: string;
  href?: string;
}

export interface ForumHeroProps {
  title: string;
  description?: string | null;
  breadcrumbs?: ForumHeroBreadcrumbItem[];
  meta?: ReactNode;
  action?: ReactNode;
  variant?: 'compact' | 'tall';
}

/**
 * Shared gradient hero used at the top of forum pages.
 *
 * Supports an optional breadcrumb trail rendered on the hero (so we can drop
 * the duplicate breadcrumb that previously sat below the hero), a description,
 * a meta row (e.g. thread counts), and a primary action slot.
 */
export function ForumHero({
  title,
  description,
  breadcrumbs,
  meta,
  action,
  variant = 'compact',
}: ForumHeroProps) {
  const variantClass = variant === 'tall' ? styles.heroTall : styles.heroCompact;

  return (
    <section className={`${styles.hero} ${variantClass}`}>
      <div className={styles.heroGradient} aria-hidden="true" />
      <div className={styles.heroInner}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className={styles.heroBreadcrumb} aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span
                  key={`${crumb.label}-${idx}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {!isLast && <span data-sep="true">/</span>}
                </span>
              );
            })}
          </nav>
        )}

        <div className={styles.heroBody}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>{title}</h1>
            {description && <p className={styles.heroDescription}>{description}</p>}
            {meta && <div className={styles.heroMeta}>{meta}</div>}
          </div>
          {action && <div className={styles.heroAction}>{action}</div>}
        </div>
      </div>
    </section>
  );
}
