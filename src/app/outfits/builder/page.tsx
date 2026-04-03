'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useOutfits } from '@/hooks/useOutfits';
import { useToast } from '@/lib/toast-context';
import {
  ClothingItem,
  ClothingCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  Season,
  Occasion,
  SEASON_LABELS,
  OCCASION_LABELS,
} from '@/lib/types';
import { haptics } from '@/lib/haptics';

const BUILD_CATEGORIES: ClothingCategory[] = [
  'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'jewelry',
];

export default function OutfitBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" /></div>}>
      <OutfitBuilderContent />
    </Suspense>
  );
}

function OutfitBuilderContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, loading: itemsLoading } = useClothingItems();
  const { createOutfit } = useOutfits();
  const { showToast } = useToast();

  const [selectedItems, setSelectedItems] = useState<Map<string, ClothingItem>>(new Map());
  const [activeCategory, setActiveCategory] = useState<ClothingCategory>('tops');
  const [outfitName, setOutfitName] = useState('');
  const [occasion, setOccasion] = useState<Occasion | ''>('');
  const [season, setSeason] = useState<Season | ''>('');
  const [saving, setSaving] = useState(false);

  // Pre-select item from query param
  useEffect(() => {
    const preselected = searchParams.get('item');
    if (preselected && items.length > 0) {
      const item = items.find((i) => i.id === preselected);
      if (item) {
        setSelectedItems(new Map([[item.id, item]]));
        setActiveCategory(item.category === 'tops' ? 'bottoms' : 'tops');
      }
    }
  }, [searchParams, items]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const toggleItem = (item: ClothingItem) => {
    haptics.light();
    const next = new Map(selectedItems);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.set(item.id, item);
    }
    setSelectedItems(next);
  };

  const handleSave = async () => {
    if (selectedItems.size === 0) return;
    setSaving(true);

    const name = outfitName.trim() || `Outfit ${new Date().toLocaleDateString()}`;
    const result = await createOutfit(
      name,
      Array.from(selectedItems.keys()),
      occasion || undefined,
      season || undefined
    );

    if (result) {
      router.push('/outfits');
    } else {
      showToast('Could not save outfit. Try again.', 'error');
      setSaving(false);
    }
  };

  const categoryItems = items.filter((i) => i.category === activeCategory && !i.in_laundry && !i.is_wishlist);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 p-1" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Build Outfit</h1>
          <button
            onClick={handleSave}
            disabled={saving || selectedItems.size === 0}
            className="px-4 py-1.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Selected items preview */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={outfitName}
            onChange={(e) => setOutfitName(e.target.value)}
            placeholder="Outfit name..."
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-900 bg-white"
          />
        </div>

        <div className="flex gap-2 mb-2">
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value as Occasion)}
            className="flex-1 text-xs px-2 py-1.5 rounded-xl border border-gray-200 text-gray-600 bg-white"
          >
            <option value="">Occasion</option>
            {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
              <option key={o} value={o}>{OCCASION_LABELS[o]}</option>
            ))}
          </select>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value as Season)}
            className="flex-1 text-xs px-2 py-1.5 rounded-xl border border-gray-200 text-gray-600 bg-white"
          >
            <option value="">Season</option>
            {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
              <option key={s} value={s}>{SEASON_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {selectedItems.size > 0 ? (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
            {Array.from(selectedItems.values()).map((item) => (
              <div key={item.id} className="relative flex-shrink-0">
                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden border-2 border-clossie-400">
                  <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                </div>
                <button
                  onClick={() => toggleItem(item)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-400 text-white rounded-full text-xs flex items-center justify-center"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs text-center py-3">Select items from each category below</p>
        )}
      </div>

      {/* Category picker */}
      <div className="flex overflow-x-auto hide-scrollbar gap-1 px-4 py-3 bg-white border-b border-gray-100">
        {BUILD_CATEGORIES.map((cat) => {
          const hasSelected = Array.from(selectedItems.values()).some((i) => i.category === cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === cat
                  ? 'bg-clossie-600 text-white'
                  : hasSelected
                  ? 'bg-clossie-100 text-clossie-600'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Items grid for selected category */}
      <div className="p-4">
        {itemsLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categoryItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">
              No {CATEGORY_LABELS[activeCategory].toLowerCase()} in your closet yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {categoryItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                    isSelected ? 'border-clossie-500 ring-2 ring-clossie-200' : item.is_wishlist ? 'border-dashed border-clossie-300 opacity-70' : 'border-gray-100'
                  }`}
                >
                  <img src={item.image_url} alt={item.category} className="w-full h-full object-contain bg-white" />
                  {item.is_wishlist && (
                    <div className="absolute top-0.5 left-0.5 bg-clossie-100 text-clossie-600 text-[8px] px-1 py-0.5 rounded font-medium leading-none">
                      Want
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
