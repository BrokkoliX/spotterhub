import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

interface Props {
  params: Promise<{ category: string; article: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, article } = await params;
  const title = article
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { title: `${title} — SpotterSpace Help` };
}

export default async function ArticlePage({ params }: Props) {
  const { category, article } = await params;

  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>
          {article
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}
        </h1>
        <p className={styles.articleDescription}>
          Learn how to make the most of this feature on SpotterSpace.
        </p>
      </div>

      <div className={styles.section}>
        <p className={styles.body}>
          This article is coming soon. If you need immediate help, please{' '}
          <Link href="/contact">contact our team</Link> or ask in the{' '}
          <Link href="/forum">community forum</Link>.
        </p>
      </div>

      <div className={styles.feedback}>
        <span className={styles.feedbackText}>Was this page helpful?</span>
        <button type="button" className={styles.feedbackBtn}>
          👍 Yes
        </button>
        <button type="button" className={styles.feedbackBtn}>
          👎 No
        </button>
      </div>
    </div>
  );
}
