'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import {
  ClothingItem,
  OutfitSuggestion,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
} from '@/lib/types';
import { getSeasonFromMonth } from '@/lib/date-utils';
import Link from 'next/link';

const DUEL_MESSAGES = [
  'Crafting two looks...',
  'Building your matchup...',
  'Styling two vibes...',
  'Almost ready...',
];

export default function DuelsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      }
    >
      <DuelsContent />
    </Suspense>
  );
}

interface DuelOutfit {
  name: string;
  reason: string;
  items: ClothingItem[];
  itemIds: string[];
  colors: string[];
  categories: string[];
}

function DuelsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading: itemsLoading } = useClothingItems();
  const { showToast } = useToast();

  const [outfits, setOutfits] = useState<[DuelOutfit, DuelOutfit] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(DUEL_MESSAGES[0]);
  const [chosen, setChosen] = useState<0 | 1 | null>(null);
  const [duelCount, setDuelCount] = useState(0);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const currentSeason = getSeasonFromMonth();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % DUEL_MESSAGES.length;
      setLoadingMsg(DUEL_MESSAGES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const availableItems = items.filter((i) => !i.in_laundry && !i.is_wishlist);

  // Auto-generate on first load
  useEffect(() => {
    if (itemsLoading || availableItems.length < 5 || outfits || loading) return;
    handleGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsLoading]);

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setOutfits(null);
    setChosen(null);
    setLoadingMsg(DUEL_MESSAGES[0]);

    const filtered = availableItems.filter(
      (i) => i.season === currentSeason || i.season === 'all-season'
    );
    const pool = filtered.length >= 5 ? filtered : availableItems;

    const compactItems = pool.map((i) => ({
      id: i.id,
      category: i.category,
      subcategory: i.subcategory,
      color: i.color,
      secondary_color: i.secondary_color,
      season: i.season,
      occasion: i.occasion,
      wear_count: i.wear_count,
      last_worn_at: i.last_worn_at,
      is_favorite: i.is_favorite,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/ai/suggest-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          items: compactItems,
          season: currentSeason,
          preferUnworn: true,
          count: 2,
          contrasting: true,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const raw: OutfitSuggestion[] = data.suggestions || [];

      const itemMap = new Map(items.map((i) => [i.id, i]));
      const resolved = raw
        .map((s) => {
          const resolvedItems = s.item_ids
            .map((id) => itemMap.get(id))
            .filter((item): item is ClothingItem => item !== undefined);
          return {
            name: s.name,
            reason: s.reason,
            items: resolvedItems,
            itemIds: resolvedItems.map((i) => i.id),
            colors: [...new Set(resolvedItems.map((i) => i.color))],
            categories: [...new Set(resolvedItems.map((i) => i.category))],
          };
        })
        .filter((s) => s.items.length >= 2);

      clearTimeout(timeout);
      if (!mountedRef.current) return;
      if (resolved.length >= 2) {
        setOutfits([resolved[0], resolved[1]]);
      } else {
        showToast('Need more variety in your closet for a duel!', 'info');
      }
    } catch {
      clearTimeout(timeout);
      if (!mountedRef.current) return;
      showToast('Could not generate duel. Try again.', 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, availableItems, currentSeason, items, showToast]);

  const handleChoose = async (index: 0 | 1) => {
    if (!outfits || chosen !== null) return;
    haptics.success();
    setChosen(index);
    setDuelCount((c) => c + 1);

    const winner = outfits[index];
    const loser = outfits[index === 0 ? 1 : 0];

    // Log preference (fire and forget)
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chosen_item_ids: winner.itemIds,
        rejected_item_ids: loser.itemIds,
        chosen_colors: winner.colors,
        rejected_colors: loser.colors,
        chosen_categories: winner.categories,
        rejected_categories: loser.categories,
      }),
    }).catch(() => {});

    // Load next duel after a brief pause
    autoAdvanceRef.current = setTimeout(() => {
      if (mountedRef.current) handleGenerate();
    }, 1200);
  };

  if (authLoading) return null;

  if (!itemsLoading && availableItems.length < 5) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="px-6 pt-12 pb-4">
          <button onClick={() => router.back()} aria-label="Go back" className="text-gray-400 text-sm">{'\u2190'} Back</button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Outfit Duels</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="text-5xl mb-4">{'\u2694\uFE0F'}</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Need more items</h3>
          <p className="text-gray-400 text-center text-sm mb-4">
            Add at least 5 items to start dueling outfits.
          </p>
          <Link href="/add" className="px-6 py-3 bg-clossie-600 text-white rounded-xl font-semibold">
            Add Items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-2">
        <button onClick={() => router.back()} aria-label="Go back" className="text-gray-400 text-sm">{'\u2190'} Back</button>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outfit Duels</h1>
          {duelCount > 0 && (
            <span className="text-xs bg-clossie-50 dark:bg-clossie-950 text-clossie-600 px-2.5 py-1 rounded-full font-medium">
              {duelCount} duel{duelCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">Which outfit speaks to you?</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">{loadingMsg}</p>
        </div>
      )}

      {/* Duel cards */}
      {outfits && !loading && (
        <div className="px-4 mt-4">
          <div className="space-y-3 relative">
            {/* VS badge */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-clossie-600 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg">
              VS
            </div>

            {outfits.map((outfit, idx) => {
              const isChosen = chosen === idx;
              const isRejected = chosen !== null && chosen !== idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleChoose(idx as 0 | 1)}
                  disabled={chosen !== null}
                  aria-label={`Choose outfit: ${outfit.name}`}
                  className={`w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-4 text-left transition-all duration-300 ${
                    isChosen
                      ? 'border-clossie-400 scale-[1.02] shadow-md ring-2 ring-clossie-200'
                      : isRejected
                        ? 'border-gray-100 dark:border-gray-800 opacity-40 scale-[0.98]'
                        : 'border-gray-100 dark:border-gray-800 active:scale-[0.98]'
                  }`}
                >
                  {isChosen && (
                    <div className="text-xs text-clossie-600 font-bold mb-2">{'\u2713'} Your pick!</div>
                  )}
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{outfit.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 mb-3">{outfit.reason}</p>

                  {/* Item thumbnails */}
                  <div className="flex gap-2 overflow-x-auto">
                    {outfit.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
                      >
                        <img
                          src={item.image_url}
                          alt={item.category}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Color dots */}
                  <div className="flex gap-1.5 mt-2">
                    {outfit.colors.map((color, ci) => (
                      <div
                        key={ci}
                        role="img"
                        aria-label={color}
                        className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Skip button */}
          {chosen === null && (
            <button
              onClick={handleGenerate}
              className="w-full mt-4 py-2 text-gray-400 text-sm font-medium"
            >
              Skip — show me different outfits
            </button>
          )}
        </div>
      )}

      {/* Loading items */}
      {itemsLoading && !loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
