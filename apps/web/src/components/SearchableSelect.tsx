'use client';

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

import styles from './SearchableSelect.module.css';

export interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  /** Static list for small client-side filtered sets. */
  options?: SearchableOption[];
  /** Called when the user types in the search box (for server-side search). */
  onSearchChange?: (query: string) => void;
  /** External options result — component filters locally when provided. */
  searchResults?: SearchableOption[];
  isLoading?: boolean;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  noOptionsMessage?: string;
}

export default function SearchableSelect({
  options,
  onSearchChange,
  searchResults,
  isLoading = false,
  value,
  onChange,
  placeholder = 'Search…',
  noOptionsMessage = 'No options found',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use provided search results, otherwise fall back to static options
  const displayOptions = searchResults ?? options ?? [];

  const selectedOption = displayOptions.find((o) => o.id === value);
  const hasServerSearch = !!onSearchChange;

  useEffect(() => {
    // Close dropdown when results come back (user can still type to refine)
    if (!isLoading) setOpen((prev) => (prev || query.length > 0 ? prev : false));
  }, [isLoading, query.length]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);
    if (!open) setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(val);
    }, hasServerSearch ? 250 : 0);
  };

  const selectOption = useCallback(
    (opt: SearchableOption) => {
      onChange(opt.id);
      setQuery('');
      setOpen(false);
      setHighlightedIndex(-1);
      onSearchChange?.('');
    },
    [onChange, onSearchChange],
  );

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
    setHighlightedIndex(-1);
    onSearchChange?.('');
    inputRef.current?.focus();
  };

  // Client-side filter for static options
  const filtered = hasServerSearch
    ? displayOptions
    : displayOptions.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()),
      );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectOption(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {selectedOption ? (
        <div className={styles.selected}>
          <span className={styles.selectedLabel}>{selectedOption.label}</span>
          {selectedOption.sublabel && (
            <span className={styles.selectedMeta}>{selectedOption.sublabel}</span>
          )}
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clear}
            aria-label="Clear selection"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onClick={() => query.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-autocomplete={hasServerSearch ? 'none' : 'list'}
        />
      )}

      {open && (
        <>
          {isLoading ? (
            <div className={styles.dropdown}>
              <div className={styles.status}>Searching…</div>
            </div>
          ) : filtered.length > 0 ? (
            <ul className={styles.dropdown} role="listbox">
              {filtered.map((opt, i) => (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  className={`${styles.item} ${i === highlightedIndex ? styles.itemHighlighted : ''}`}
                  onMouseDown={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  <span className={styles.itemLabel}>{opt.label}</span>
                  {opt.sublabel && (
                    <span className={styles.itemMeta}>{opt.sublabel}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.dropdown}>
              <div className={styles.status}>{noOptionsMessage}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
