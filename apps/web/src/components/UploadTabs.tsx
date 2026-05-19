'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './UploadTabs.module.css';

const TABS = [
  { href: '/upload', label: '📷 Upload Photo' },
  { href: '/my-uploads', label: '📋 My Uploads' },
] as const;

export function UploadTabs() {
  const pathname = usePathname();

  return (
    <nav className={styles.tabs} aria-label="Upload navigation">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
