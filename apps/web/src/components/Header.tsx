'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import {
  GET_NOTIFICATIONS,
  GET_UNREAD_COUNT,
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
} from '@/lib/queries';

import { SearchModal } from '@/components/SearchModal';
import styles from './Header.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationNode {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notificationHref(data: Record<string, unknown> | null): string {
  if (!data) return '/';
  if (data.photoId) return `/photos/${data.photoId}`;
  if (data.communityId) return `/communities`;
  return '/';
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [unreadResult, refetchUnread] = useQuery({
    query: GET_UNREAD_COUNT,
    requestPolicy: 'cache-and-network',
  });

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(() => {
      refetchUnread({ requestPolicy: 'network-only' });
    }, 30_000);
    return () => clearInterval(id);
  }, [refetchUnread]);

  const [notifResult, refetchNotifs] = useQuery({
    query: GET_NOTIFICATIONS,
    variables: { first: 10 },
    requestPolicy: 'network-only',
    pause: !open,
  });

  const [, markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [, markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unreadCount: number = unreadResult.data?.unreadNotificationCount ?? 0;
  const displayCount = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : '';

  const notifications: NotificationNode[] =
    notifResult.data?.notifications?.edges?.map((e: { node: NotificationNode }) => e.node) ?? [];

  async function handleNotificationClick(n: NotificationNode) {
    if (!n.isRead) {
      await markRead({ id: n.id });
      refetchUnread({ requestPolicy: 'network-only' });
    }
    setOpen(false);
    router.push(notificationHref(n.data));
  }

  async function handleMarkAll() {
    await markAllRead({});
    refetchUnread({ requestPolicy: 'network-only' });
    refetchNotifs({ requestPolicy: 'network-only' });
  }

  return (
    <div className={styles.notificationWrap} ref={dropdownRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
      >
        🔔
        {displayCount && <span className={styles.badge}>{displayCount}</span>}
      </button>

      {open && (
        <div className={styles.notifDropdown}>
          <div className={styles.notifHeader}>
            <span className={styles.notifTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllBtn} onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          {notifResult.fetching && <p className={styles.notifEmpty}>Loading…</p>}

          {!notifResult.fetching && notifications.length === 0 && (
            <p className={styles.notifEmpty}>No notifications yet.</p>
          )}

          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`${styles.notifItem} ${!n.isRead ? styles.notifItemUnread : ''}`}
              onClick={() => handleNotificationClick(n)}
            >
              <span className={styles.notifItemTitle}>{n.title}</span>
              {n.body && <span className={styles.notifItemBody}>{n.body}</span>}
              <span className={styles.notifItemTime}>{relativeTime(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { user, ready, signOut } = useAuth();
  const { theme, ready: themeReady, toggleTheme } = useTheme();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K to open search modal
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  const showUser = ready && user;
  const showGuest = ready && !user;
  const isAdmin = showUser && (user.role === 'admin' || user.role === 'moderator');
  const isSuperuser = showUser && user.role === 'superuser';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>✈️</span>
          <span>SpotterSpace</span>
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
          <Link href="/map" className={styles.navLink}>
            Map
          </Link>
          <Link href="/explore" className={styles.navLink}>
            Explore
          </Link>
          <Link href="/forum" className={styles.navLink}>
            Forum
          </Link>
          <Link href="/communities" className={styles.navLink}>
            Communities
          </Link>
          <Link href="/marketplace" className={styles.navLink}>
            Marketplace
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
          {(isAdmin || isSuperuser) && (
            <Link href="/admin" className={styles.navLink}>
              Admin
            </Link>
          )}
        </nav>

        <button
          type="button"
          className={styles.searchBtn}
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search (⌘K)"
        >
          🔍
        </button>

        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        <div className={styles.actions}>
          {themeReady && (
            <button
              type="button"
              onClick={toggleTheme}
              className={styles.themeToggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}
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
              <NotificationBell />
              <Link href={`/u/${user.username}/photos`} className={styles.username}>
                {isSuperuser && (
                  <span title="Superuser" style={{ marginRight: 4 }}>
                    🛡️
                  </span>
                )}
                {user.username}
              </Link>
              <Link href="/settings/profile" className={styles.navLink} title="Settings">
                ⚙
              </Link>
              <button onClick={handleSignOut} className="btn btn-secondary" type="button">
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
