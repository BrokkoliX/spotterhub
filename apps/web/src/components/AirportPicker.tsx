'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';

import { SEARCH_AIRPORTS } from '@/lib/queries';

import styles from './AirportPicker.module.css';

export interface Airport {
  icaoCode: string;
  iataCode: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
}

interface AirportPickerProps {
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
  placeholder?: string;
}

export default function AirportPicker({
  value,
  onChange,
  placeholder = 'Search airport (e.g. KLAX, Los Angeles)',
}: AirportPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive urql variables reactively from `debouncedQuery`. urql v5's
  // executeQuery does not accept new variables, so manual triggering with
  // `pause: true` silently no-ops. Instead, gate execution via `pause` based
  // on debounced input length.
  const [searchResult] = useQuery({
    query: SEARCH_AIRPORTS,
    variables: { query: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  useEffect(() => {
    if (searchResult.data?.searchAirports) {
      setResults(searchResult.data.searchAirports as Airport[]);
      // Auto-open dropdown when results arrive
      if (searchResult.data.searchAirports.length > 0) {
        setOpen(true);
      }
    } else {
      setResults([]);
    }
  }, [searchResult.data]);

  // Debounce input → debouncedQuery, which urql watches via `variables`.
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);
    setOpen(false); // close dropdown while typing; re-opens via effect above
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2) {
        setDebouncedQuery(val);
      } else {
        setDebouncedQuery('');
        setResults([]);
      }
    }, 300);
  };

  const selectAirport = (airport: Airport) => {
    onChange(airport);
    setQuery('');
    setOpen(false);
    setResults([]);
    setHighlightedIndex(-1);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

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
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectAirport(results[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {value ? (
        <div className={styles.selected}>
          <span className={styles.selectedCode}>{value.icaoCode}</span>
          <span className={styles.selectedName}>{value.name}</span>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clear}
            aria-label="Clear airport"
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
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
        />
      )}

      {open && results.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {results.map((airport, i) => (
            <li
              key={airport.icaoCode}
              role="option"
              aria-selected={i === highlightedIndex}
              className={`${styles.item} ${i === highlightedIndex ? styles.itemHighlighted : ''}`}
              onMouseDown={() => selectAirport(airport)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span className={styles.itemCode}>{airport.icaoCode}</span>
              <span className={styles.itemName}>{airport.name}</span>
              <span className={styles.itemMeta}>
                {[airport.city, airport.country].filter(Boolean).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && query.length > 0 && results.length === 0 && !searchResult.fetching && (
        <div className={styles.noResults}>No airports found</div>
      )}

      {searchResult.fetching && query.length >= 2 && (
        <div className={styles.noResults}>Searching…</div>
      )}
    </div>
  );
}
