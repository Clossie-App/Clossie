'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useToast } from '@/lib/toast-context';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import ClothingGrid from '@/components/closet/ClothingGrid';
import { ClothingItem, ClothingCategory, CATEGORY_LABELS, CATEGORY_ICONS, Season, Occasion, SEASON_LABELS, OCCASION_LABELS } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ALL_CATEGORIES: (ClothingCategory | 'all')[] = [
  'all', 'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'jewelry', 'activewear',
];

export default function ClosetPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading, fetchItems, deleteItem, updateItem } = useClothingItems();
  const { showToast } = useToast();
  const { pulling, pullDistance, refreshing, handlers: pullHandlers } = usePullToRefresh(fetchItems);
  const [activeCategory, setActiveCategory] = useState<ClothingCategory | 'all'>('all');
  const [filterSeason, setFilterSeason] = useState<Season | 'all'>('all');
  const [filterOccasion, setFilterOccasion] = useState<Occasion | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'most-worn' | 'least-worn'>('newest');
  const [viewMode, setViewMode] = useState<'owned' | 'wishlist' | 'all'>('owned');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Owned vs wishlist filter
    if (viewMode === 'owned') {
      result = result.filter((item) => !item.is_wishlist);
    } else if (viewMode === 'wishlist') {
      result = result.filter((item) => item.is_wishlist);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.color?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.subcategory?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      result = result.filter((item) => item.category === activeCategory);
    }
    if (filterSeason !== 'all') {
      result = result.filter((item) => item.season === filterSeason || item.season === 'all-season');
    }
    if (filterOccasion !== 'all') {
      result = result.filter((item) => item.occasion === filterOccasion);
    }

    switch (sortBy) {
      case 'most-worn':
        result = [...result].sort((a, b) => b.wear_count - a.wear_count);
        break;
      case 'least-worn':
        result = [...result].sort((a, b) => a.wear_count - b.wear_count);
        break;
      default:
        break; // already sorted by newest from the hook
    }

    return result;
  }, [items, searchQuery, activeCategory, filterSeason, filterOccasion, sortBy, viewMode]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await deleteItem(id);
    if (ok) showToast('Item deleted', 'success');
    else showToast('Could not delete item', 'error');
    return ok;
  }, [deleteItem, showToast]);

  const handleToggleLaundry = useCallback(async (item: ClothingItem) => {
    const next = !item.in_laundry;
    const result = await updateItem(item.id, { in_laundry: next });
    if (result) showToast(next ? 'Moved to laundry' : 'Marked as clean', 'success');
    else showToast('Could not update item', 'error');
  }, [updateItem, showToast]);

  const handleToggleFavorite = useCallback(async (item: ClothingItem) => {
    const result = await updateItem(item.id, { is_favorite: !item.is_favorite });
    if (!result) showToast('Could not update item', 'error');
  }, [updateItem, showToast]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50" {...pullHandlers}>
      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div className="flex justify-center py-2" style={{ height: pullDistance }}>
          <div className={`w-6 h-6 border-2 border-clossie-200 border-t-clossie-600 rounded-full ${refreshing ? 'ptr-spinner' : ''}`}
            style={{ opacity: Math.min(pullDistance / 40, 1) }} />
        </div>
      )}
      {/* Header */}
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">My Closet</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-xl transition ${showFilters ? 'bg-clossie-100 text-clossie-600' : 'text-gray-400'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
              </button>
              <span className="text-sm text-gray-400">{filteredItems.length} items</span>
            </div>
          </div>

          {/* Owned / Wishlist / All toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mt-3">
            {[
              { key: 'owned' as const, label: 'My Closet' },
              { key: 'wishlist' as const, label: 'Wishlist' },
              { key: 'all' as const, label: 'All' },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === v.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by color, brand, or type..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-clossie-300 focus:border-clossie-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-1 px-4 pb-3">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                activeCategory === cat
                  ? 'bg-clossie-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {cat === 'all' ? 'All' : `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-4 pb-3 space-y-3 border-t border-gray-100 pt-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Season</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                <button
                  onClick={() => setFilterSeason('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterSeason === 'all' ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  All
                </button>
                {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterSeason(s)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterSeason === s ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {SEASON_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Occasion</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                <button
                  onClick={() => setFilterOccasion('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterOccasion === 'all' ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  All
                </button>
                {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => setFilterOccasion(o)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterOccasion === o ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {OCCASION_LABELS[o]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sort</label>
              <div className="flex gap-1 mt-1">
                {[
                  { key: 'newest' as const, label: 'Newest' },
                  { key: 'most-worn' as const, label: 'Most Worn' },
                  { key: 'least-worn' as const, label: 'Least Worn' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${sortBy === s.key ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="pt-4 pb-4">
        {(() => {
          const isFiltered = activeCategory !== 'all' || filterSeason !== 'all' || filterOccasion !== 'all' || searchQuery.trim() !== '';
          const hasNoItemsAtAll = !loading && items.filter(i => viewMode === 'owned' ? !i.is_wishlist : viewMode === 'wishlist' ? i.is_wishlist : true).length === 0;

          if (viewMode === 'wishlist' && hasNoItemsAtAll) {
            return (
              <ClothingGrid
                items={filteredItems}
                loading={loading}
                emptyIcon="✨"
                emptyTitle="Your wishlist is empty"
                emptyDescription="See something you love? Share it to Clossie or tap + to add it."
                emptyAction={{ label: 'Add to Wishlist', href: '/add' }}
              />
            );
          }

          if (isFiltered && filteredItems.length === 0 && !loading) {
            return (
              <ClothingGrid
                items={filteredItems}
                loading={loading}
                emptyIcon="🔍"
                emptyTitle="No items match"
                emptyDescription="Try clearing your search or adjusting your filters."
              />
            );
          }

          if (hasNoItemsAtAll) {
            return (
              <ClothingGrid
                items={filteredItems}
                loading={loading}
                emptyIcon="👗"
                emptyTitle="Your closet is empty"
                emptyDescription="Add your first item and let the AI do the work — it tags everything automatically."
                emptyAction={{ label: 'Add First Item', href: '/add' }}
              />
            );
          }

          return (
            <ClothingGrid
              items={filteredItems}
              loading={loading}
              onDelete={handleDelete}
              onToggleLaundry={handleToggleLaundry}
              onToggleFavorite={handleToggleFavorite}
            />
          );
        })()}
      </div>
    </div>
  );
}
