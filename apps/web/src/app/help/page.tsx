import Link from 'next/link';
import type { Metadata } from 'next';
import { HELP_CATEGORIES } from '@/lib/help-categories';
import styles from './help.module.css';

export const metadata: Metadata = {
  title: 'Help Center — SpotterSpace',
  description:
    'Find answers to common questions about using SpotterSpace, managing your account, and more.',
};

export default function HelpIndexPage() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.content}>
          <div className={styles.articleHeader}>
            <h1 className={styles.articleTitle}>Help Center</h1>
            <p className={styles.articleDescription}>
              Find answers and guides for getting the most out of SpotterSpace.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            {HELP_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/help/${category.slug}`}
                className={styles.categoryCard}
              >
                <div className={styles.categoryCardTitle}>{category.title}</div>
                <div className={styles.categoryCardDesc}>{category.description}</div>
                <div className={styles.categoryCardCount}>
                  {category.articles.length} article{category.articles.length !== 1 ? 's' : ''}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
