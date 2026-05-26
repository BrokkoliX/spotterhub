'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HELP_CATEGORIES } from '@/lib/help-categories';
import styles from './help.module.css';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav aria-label="Help sections">
              <div className={styles.sidebarHeader}>
                <Link href="/help" className={styles.sidebarTitle}>
                  Help Center
                </Link>
              </div>
              {HELP_CATEGORIES.map((category) => (
                <div key={category.slug} className={styles.category}>
                  <Link href={`/help/${category.slug}`} className={styles.categoryTitle}>
                    {category.title}
                  </Link>
                  <ul className={styles.articleList}>
                    {category.articles.map((article) => {
                      const isActive = pathname === article.href;
                      return (
                        <li key={article.slug}>
                          <Link
                            href={article.href}
                            className={`${styles.articleLink} ${isActive ? styles.active : ''}`}
                          >
                            {article.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}
