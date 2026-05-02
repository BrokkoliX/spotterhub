'use client';

import { useCallback, useState } from 'react';
import { useQuery } from 'urql';
import Link from 'next/link';

import { useAuth } from '@/lib/auth';
import { GET_MARKETPLACE_ITEMS, GET_MARKETPLACE_CATEGORIES } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemImage {
  id: string;
  variantType: string;
  url: string;
  width: number;
  height: number;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  label: string;
  sortOrder: number;
  itemCount: number;
}

interface Seller {
  id: string;
  bio: string | null;
  website: string | null;
  averageRating: number;
  feedbackCount: number;
  user: {
    id: string;
    username: string;
    profile: { displayName: string | null; avatarUrl: string | null } | null;
  };
}

interface MarketplaceItem {
  id: string;
  title: string;
  description: string | null;
  priceUsd: string;
  condition: string;
  location: string | null;
  moderationStatus: string;
  active: boolean;
  averageRating: number;
  feedbackCount: number;
  createdAt: string;
  category: Category;
  images: ItemImage[];
  seller: Seller;
}

// ─── Condition Badge ─────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, { label: string; className: string }> = {
  mint: { label: 'Mint', className: styles.conditionMint },
  excellent: { label: 'Excellent', className: styles.conditionExcellent },
  good: { label: 'Good', className: styles.conditionGood },
  fair: { label: 'Fair', className: styles.conditionFair },
  poor: { label: 'Poor', className: styles.conditionPoor },
};

function ConditionBadge({ condition }: { condition: string }) {
  const info = CONDITION_LABELS[condition] ?? { label: condition, className: '' };
  return <span className={`${styles.conditionBadge} ${info.className}`}>{info.label}</span>;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const fullStars = Math.round(rating);
  return (
    <span className={styles.stars}>
      {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
      <span className={styles.ratingText}>{rating.toFixed(1)}</span>
      <span className={styles.ratingCount}>({count})</span>
    </span>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: MarketplaceItem }) {
  const thumb = item.images.find((i) => i.variantType === 'thumbnail') ?? item.images[0];
  const imgUrl = thumb?.url ?? '';
  const primaryImage = item.images.find((i) => i.variantType === 'display') ?? thumb;

  return (
    <Link href={`/marketplace/item/${item.id}`} className={styles.itemCard}>
      <div className={styles.itemImageWrap}>
        {primaryImage ? (
          <img src={primaryImage.url} alt={item.title} className={styles.itemImage} />
        ) : (
          <div className={styles.itemImagePlaceholder}>📦</div>
        )}
        <div className={styles.itemPrice}>${item.priceUsd}</div>
      </div>
      <div className={styles.itemBody}>
        <h3 className={styles.itemTitle}>{item.title}</h3>
        <div className={styles.itemMeta}>
          <ConditionBadge condition={item.condition} />
          {item.location && (
            <span className={styles.itemLocation}>{item.location}</span>
          )}
        </div>
        <div className={styles.itemSeller}>
          <StarRating rating={item.averageRating} count={item.feedbackCount} />
        </div>
        <div className={styles.itemCategory}>{item.category.label}</div>
      </div>
    </Link>
  );
}

// ─── Filter Sidebar ──────────────────────────────────────────────────────────

interface FiltersProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  selectedCondition: string;
  onConditionChange: (cond: string) => void;
}

function Filters({
  categories,
  selectedCategory,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  selectedCondition,
  onConditionChange,
}: FiltersProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.filterSection}>
        <h3 className={styles.filterTitle}>Category</h3>
        <select
          className={styles.filterSelect}
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.label} ({cat.itemCount})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterSection}>
        <h3 className={styles.filterTitle}>Price Range (USD)</h3>
        <div className={styles.priceInputs}>
          <input
            type="number"
            className={styles.priceInput}
            placeholder="Min"
            value={priceRange[0] || ''}
            onChange={(e) => onPriceRangeChange([Number(e.target.value) || 0, priceRange[1]])}
            min={0}
          />
          <span className={styles.priceDash}>–</span>
          <input
            type="number"
            className={styles.priceInput}
            placeholder="Max"
            value={priceRange[1] || ''}
            onChange={(e) => onPriceRangeChange([priceRange[0], Number(e.target.value) || 0])}
            min={0}
          />
        </div>
      </div>

      <div className={styles.filterSection}>
        <h3 className={styles.filterTitle}>Condition</h3>
        <div className={styles.conditionList}>
          {['', 'mint', 'excellent', 'good', 'fair', 'poor'].map((cond) => (
            <label key={cond} className={styles.conditionOption}>
              <input
                type="radio"
                name="condition"
                value={cond}
                checked={selectedCondition === cond}
                onChange={() => onConditionChange(cond)}
              />
              {cond === '' ? 'Any' : CONDITION_LABELS[cond]?.label ?? cond}
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating_desc', label: 'Top Rated' },
];

const PAGE_SIZE = 24;

export default function MarketplacePage() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [selectedCondition, setSelectedCondition] = useState('');

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    // Simple debounce via setTimeout
    setTimeout(() => setDebouncedSearch(value), 400);
  };

  // Categories query
  const [{ data: categoriesData }] = useQuery({ query: GET_MARKETPLACE_CATEGORIES });
  const categories: Category[] = categoriesData?.marketplaceCategories ?? [];

  // Items query
  const [{ data, fetching, error }] = useQuery({
    query: GET_MARKETPLACE_ITEMS,
    variables: {
      category: selectedCategory || undefined,
      minPrice: priceRange[0] || undefined,
      maxPrice: priceRange[1] || undefined,
      condition: selectedCondition || undefined,
      search: debouncedSearch || undefined,
      sortBy,
      first: PAGE_SIZE,
    },
  });

  const items: MarketplaceItem[] = data?.marketplaceItems?.edges.map(
    (e: { node: MarketplaceItem }) => e.node,
  ) ?? [];
  const hasNextPage = data?.marketplaceItems?.pageInfo?.hasNextPage ?? false;
  const totalCount = data?.marketplaceItems?.totalCount ?? 0;

  const handleLoadMore = useCallback(() => {
    // Cursor pagination could be added here
  }, []);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroEmoji}>🛍️</div>
          <h1 className={styles.heroTitle}>Collectibles Marketplace</h1>
          <p className={styles.heroSubtitle}>
            Aviation memorabilia, models, gear, and more
          </p>
          {totalCount > 0 && (
            <p className={styles.listingCount}>
              {totalCount.toLocaleString()} item{totalCount !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.layout}>
          {/* Sidebar */}
          <Filters
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            selectedCondition={selectedCondition}
            onConditionChange={setSelectedCondition}
          />

          {/* Main */}
          <div className={styles.main}>
            {/* Controls */}
            <div className={styles.controls}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search collectibles…"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <div className={styles.sortPills}>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.sortPill} ${sortBy === opt.value ? styles.sortPillActive : ''}`}
                    onClick={() => setSortBy(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            {totalCount > 0 && (
              <p className={styles.totalCount}>
                {totalCount.toLocaleString()} item{totalCount !== 1 ? 's' : ''}
              </p>
            )}

            <div className={styles.sellCta}>
              {user?.sellerProfile?.approved ? (
                <Link href="/sell/listings/new" className="btn btn-primary">
                  ✈️ Add Item
                </Link>
              ) : (
                <Link href="/sell" className="btn btn-primary">
                  ✈️ Start Selling
                </Link>
              )}
            </div>

            {/* Grid */}
            {fetching && items.length === 0 ? (
              <p className={styles.loading}>Loading marketplace…</p>
            ) : error ? (
              <p className={styles.error}>Failed to load marketplace. Please try again.</p>
            ) : items.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📦</div>
                <h2 className={styles.emptyTitle}>No items found</h2>
                <p className={styles.emptyText}>
                  Try adjusting your filters or check back later.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
                {hasNextPage && (
                  <div className={styles.loadMore}>
                    <button
                      className={styles.loadMoreBtn}
                      onClick={handleLoadMore}
                      type="button"
                      disabled
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}