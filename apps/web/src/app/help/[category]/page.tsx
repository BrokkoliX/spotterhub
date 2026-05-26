import Link from 'next/link';
import type { Metadata } from 'next';
import { HELP_CATEGORIES } from '@/lib/help-categories';
import styles from '../help.module.css';

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const cat = HELP_CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return { title: 'Help' };
  return { title: `${cat.title} — Help Center` };
}

export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const cat = HELP_CATEGORIES.find((c) => c.slug === slug);

  if (!cat) {
    return (
      <div className={styles.article}>
        <Link href="/help" className={styles.backLink}>
          ← Back to Help Center
        </Link>
        <h1 className={styles.articleTitle}>Category not found</h1>
        <p className={styles.body}>This help category does not exist.</p>
      </div>
    );
  }

  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Back to Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>{cat.title}</h1>
        <p className={styles.articleDescription}>{cat.description}</p>
      </div>

      <div>
        {cat.articles.map((article) => (
          <div key={article.slug} className={styles.section}>
            <Link href={article.href}>
              <h2 className={styles.sectionTitle}>{article.title}</h2>
            </Link>
            <p className={styles.body}>
              Learn more about {article.title.toLowerCase()} in our detailed guide.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
