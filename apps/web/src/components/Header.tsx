'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';

import styles from './Header.module.css';

export function Header() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  const showUser = ready && user;
  const showGuest = ready && !user;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>✈️</span>
          <span>SpotterHub</span>
        </Link>

        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Feed
          </Link>
          {showUser && (
            <Link href="/following" className={styles.navLink}>
              Following
            </Link>
          )}
          <Link href="/search" className={styles.navLink}>
            Search
          </Link>
          <Link href="/map" className={styles.navLink}>
            Map
          </Link>
          {showUser && (
            <Link href="/albums" className={styles.navLink}>
              Albums
            </Link>
          )}
          {showUser && (
            <Link href="/upload" className={styles.navLink}>
              Upload
            </Link>
          )}
        </nav>

        <div className={styles.actions}>
          {showGuest && (
            <>
              <Link href="/signin" className="btn btn-secondary">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
          {showUser && (
            <>
              <Link
                href={`/u/${user.username}/photos`}
                className={styles.username}
              >
                {user.username}
              </Link>
              <Link
                href="/settings/profile"
                className={styles.navLink}
                title="Settings"
              >
                ⚙
              </Link>
              <button
                onClick={handleSignOut}
                className="btn btn-secondary"
                type="button"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
