'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useOutfits } from '@/hooks/useOutfits';
import { useToast } from '@/lib/toast-context';
import {
  ClothingItem,
  OutfitSuggestion,
  Season,
  Occasion,
  SEASON_LABELS,
  OCCASION_LABELS,
  CATEGORY_ICONS,
} from '@/lib/types';
import Link from 'next/link';

const LOADING_MESSAGES = [
  'Raiding your closet...',
  'Matching colors...',
  'Finding your look...',
  'Styling outfits...',
  'Almost ready...',
];

export default function SuggestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      }
    >
      <SuggestContent />
    </Suspense>
  );
}

interface ResolvedSuggestion {
  name: string;
  reason: string;
  items: ClothingItem[];
  saved: boolean;
}

function SuggestContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, loading: itemsLoading } = useClothingItems();
  const { createOutfit } = useOutfits();
  const { showToast } = useToast();

  const [suggestions, setSuggestions] = useState<ResolvedSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  // Filters
  const [occasion, setOccasion] = useState<Occasion | ''>('');
  const [season, setSeason] = useState<Season | ''>('');
  const [preferUnworn, setPreferUnworn] = useState(true);

  // Pre-selected item from query param
  const preselectedId = searchParams.get('item');
  const preselectedItem = items.find((i) => i.id === preselectedId);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const availableItems = items.filter((i) => !i.in_laundry && !i.is_wishlist);
  const laundryCount = items.filter((i) => i.in_laundry).length;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);
    setLoadingMsg(LOADING_MESSAGES[0]);

    // Build filtered item list
    let filtered = availableItems;
    if (season) {
      filtered = filtered.filter((i) => i.season === season || i.season === 'all-season');
    }
    if (occasion) {
      filtered = filtered.filter((i) => i.occasion === occasion || i.occasion === 'casual');
    }

    const compactItems = filtered.map((i) => ({
      id: i.id,
      category: i.category,
      subcategory: i.subcategory,
      color: i.color,
      secondary_color: i.secondary_color,
      season: i.season,
      occasion: i.occasion,
      wear_count: i.wear_count,
      is_favorite: i.is_favorite,
    }));

    try {
      const res = await fetch('/api/ai/suggest-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: compactItems,
          occasion: occasion || undefined,
          season: season || undefined,
          mustIncludeItemId: preselectedId || undefined,
          preferUnworn,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await res.json();
      const raw: OutfitSuggestion[] = data.suggestions || [];

      // Validate item IDs — hallucination guard
      const itemMap = new Map(items.map((i) => [i.id, i]));
      const resolved: ResolvedSuggestion[] = raw
        .map((s) => ({
          name: s.name,
          reason: s.reason,
          items: s.item_ids.map((id) => itemMap.get(id)).filter(Boolean) as ClothingItem[],
          saved: false,
        }))
        .filter((s) => s.items.length >= 2);

      if (resolved.length === 0) {
        setError('AI returned suggestions we could not match to your items. Try again!');
      } else {
        setSuggestions(resolved);
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
      setHasGenerated(true);
    }
  };

  const handleSave = async (index: number) => {
    const s = suggestions[index];
    if (!s || s.saved) return;

    const result = await createOutfit(
      s.name,
      s.items.map((i) => i.id),
      occasion || undefined,
      season || undefined
    );

    if (result) {
      setSuggestions((prev) =>
        prev.map((sg, i) => (i === index ? { ...sg, saved: true } : sg))
      );
      showToast(`"${s.name}" saved to your outfits!`, 'success');
    } else {
      showToast('Could not save outfit. Try again.', 'error');
    }
  };

  if (authLoading) return null;

  // Empty state: not enough items
  if (!itemsLoading && availableItems.length < 5) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onBack={() => router.back()} />
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="text-5xl mb-4">&#x1F455;</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Need more items</h3>
          <p className="text-gray-400 text-center text-sm mb-4">
            Add at least 5 items to your closet so the AI can suggest complete outfits.
            You have {availableItems.length} item{availableItems.length !== 1 ? 's' : ''} right now.
          </p>
          <Link
            href="/add"
            className="px-6 py-3 bg-clossie-600 text-white rounded-xl font-semibold"
          >
            Add Items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onBack={() => router.back()} />

      <div className="p-4 space-y-4">
        {/* Pre-selected item banner */}
        {preselectedItem && (
          <div className="bg-clossie-50 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-clossie-200 bg-white flex-shrink-0">
              <img
                src={preselectedItem.image_url}
                alt={preselectedItem.category}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs text-clossie-600 font-medium">Styling around</p>
              <p className="text-sm text-gray-800 font-semibold">
                {CATEGORY_ICONS[preselectedItem.category]}{' '}
                {preselectedItem.subcategory || preselectedItem.category}
                {preselectedItem.color ? ` in ${preselectedItem.color}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex gap-2 mb-3">
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as Occasion)}
              className="flex-1 text-xs px-2 py-1.5 rounded-xl border border-gray-200 text-gray-600 bg-white"
            >
              <option value="">Any Occasion</option>
              {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </select>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as Season)}
              className="flex-1 text-xs px-2 py-1.5 rounded-xl border border-gray-200 text-gray-600 bg-white"
            >
              <option value="">Any Season</option>
              {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">Prioritize unworn items</span>
            <button
              onClick={() => setPreferUnworn(!preferUnworn)}
              className={`w-10 h-6 rounded-full transition-colors ${
                preferUnworn ? 'bg-clossie-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferUnworn ? 'translate-x-[18px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>

          {laundryCount > 0 && (
            <p className="text-xs text-gray-400 mb-3">
              {laundryCount} item{laundryCount !== 1 ? 's' : ''} in laundry (excluded)
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || itemsLoading}
            className="w-full py-3 bg-clossie-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? loadingMsg : hasGenerated ? 'Try Again' : 'Generate Outfit Ideas'}
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="w-16 h-16 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <button
              onClick={handleGenerate}
              className="text-clossie-600 text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Suggestion cards */}
        {!loading &&
          suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-800">{suggestion.name}</h3>
                  {suggestion.saved ? (
                    <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-xs font-medium">
                      Saved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSave(index)}
                      className="px-3 py-1.5 bg-clossie-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                    >
                      Save Outfit
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-3">{suggestion.reason}</p>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {suggestion.items.map((item) => (
                    <div key={item.id} className="flex-shrink-0 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                        <img
                          src={item.image_url}
                          alt={item.category}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {CATEGORY_ICONS[item.category]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

        {/* No results after generate */}
        {!loading && hasGenerated && suggestions.length === 0 && !error && (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">
              No matching outfits found. Try different filters!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-gray-400 p-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">AI Outfit Ideas</h1>
        <div className="w-6" />
      </div>
    </div>
  );
}
