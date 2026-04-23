'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './SearchModal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open (component remounts fresh each open, query starts empty)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-label="Search">
        <form className={styles.form} onSubmit={handleSubmit}>
          <span className={styles.icon} aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search photos, aircraft, airlines, airports, users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </form>

        <div className={styles.hint}>
          <kbd className={styles.kbd}>↵</kbd>
          <span>to search</span>
          <kbd className={styles.kbd}>Esc</kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  );
}
