import Link from 'next/link';

import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>✈️ SpotterSpace</span>
          <p className={styles.tagline}>
            The premier platform for aviation photographers.
          </p>
        </div>

        <nav className={styles.links} aria-label="Legal">
          <Link href="/legal-notice">Legal Notice</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/accessibility">Accessibility</Link>
        </nav>

        <p className={styles.copyright}>
          © {new Date().getFullYear()} SpotterSpace. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
