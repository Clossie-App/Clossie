'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useOutfits } from '@/hooks/useOutfits';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import {
  ClothingItem,
  OutfitSuggestion,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
} from '@/lib/types';
import Link from 'next/link';

const GREETINGS = [
  { hour: 5, text: 'Good morning' },
  { hour: 12, text: 'Good afternoon' },
  { hour: 17, text: 'Good evening' },
  { hour: 21, text: 'Good night' },
];

function getGreeting(): string {
  const h = new Date().getHours();
  for (let i = GREETINGS.length - 1; i >= 0; i--) {
    if (h >= GREETINGS[i].hour) return GREETINGS[i].text;
  }
  return GREETINGS[0].text;
}

function getSeasonFromMonth(): string {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

const DAILY_MESSAGES = [
  'Picking your look...',
  'Checking what you haven\'t worn...',
  'Coordinating colors...',
  'Putting it together...',
];

export default function DailyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      }
    >
      <DailyContent />
    </Suspense>
  );
}

interface DailyOutfit {
  name: string;
  reason: string;
  items: ClothingItem[];
  saved: boolean;
  wornToday: boolean;
}

function DailyContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading: itemsLoading } = useClothingItems();
  const { createOutfit, logWear } = useOutfits();
  const { showToast } = useToast();

  const [outfit, setOutfit] = useState<DailyOutfit | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(DAILY_MESSAGES[0]);
  const [error, setError] = useState('');
  const autoTriggered = useRef(false);

  const greeting = getGreeting();
  const currentSeason = getSeasonFromMonth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Auto-generate on page load
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (autoTriggered.current) return;
    if (itemsLoading || items.length === 0) return;
    const available = items.filter((i) => !i.in_laundry && !i.is_wishlist);
    if (available.length < 5) return;
    autoTriggered.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    handleGenerate(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsLoading, items.length]);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % DAILY_MESSAGES.length;
      setLoadingMsg(DAILY_MESSAGES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const availableItems = items.filter((i) => !i.in_laundry && !i.is_wishlist);

  const handleGenerate = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    setOutfit(null);
    setLoadingMsg(DAILY_MESSAGES[0]);

    // Filter for current season
    const filtered = availableItems.filter(
      (i) => i.season === currentSeason || i.season === 'all-season'
    );

    // Use all available if season filter is too restrictive
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

    try {
      const res = await fetch('/api/ai/suggest-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: compactItems,
          season: currentSeason,
          preferUnworn: true,
        }),
        signal,
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
          return { name: s.name, reason: s.reason, items: resolvedItems, saved: false, wornToday: false };
        })
        .filter((s) => s.items.length >= 2);

      if (resolved.length === 0) {
        setError('Could not build an outfit. Try refreshing!');
      } else {
        // Show the first suggestion as "today's outfit"
        setOutfit(resolved[0]);
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!outfit || outfit.saved) return;
    haptics.success();

    const result = await createOutfit(
      outfit.name,
      outfit.items.map((i) => i.id),
      undefined,
      currentSeason
    );

    if (result) {
      setOutfit({ ...outfit, saved: true });
      showToast(`"${outfit.name}" saved!`, 'success');
    } else {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleWearIt = async () => {
    if (!outfit) return;
    haptics.success();

    // Save first if not saved
    if (!outfit.saved) {
      const result = await createOutfit(
        outfit.name,
        outfit.items.map((i) => i.id),
        undefined,
        currentSeason
      );
      if (result) {
        const wore = await logWear(result.id);
        setOutfit({ ...outfit, saved: true, wornToday: !!wore });
        showToast(wore ? 'Outfit logged for today!' : 'Outfit saved! Could not log wear.', wore ? 'success' : 'info');
      } else {
        showToast('Could not save outfit.', 'error');
      }
    } else {
      showToast('Outfit already saved! Log the wear from your outfits page.', 'info');
    }
  };

  if (authLoading) return null;

  // Not enough items
  if (!itemsLoading && availableItems.length < 5) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="px-6 pt-12 pb-6">
          <p className="text-gray-400 text-sm">{greeting}{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Today&apos;s Outfit</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="text-5xl mb-4">👗</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Need more items</h3>
          <p className="text-gray-400 text-center text-sm mb-4">
            Add at least 5 items so Clossie can suggest daily outfits.
            You have {availableItems.length} right now.
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <p className="text-gray-400 text-sm">{greeting}{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Today&apos;s Outfit</h1>
        <p className="text-xs text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="w-12 h-12 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">{loadingMsg}</p>
          <p className="text-gray-400 text-xs mt-1">Finding your perfect look</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-6 py-16">
          <div className="bg-red-50 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😕</div>
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button
              onClick={() => handleGenerate()}
              className="px-5 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Today's outfit */}
      {outfit && !loading && (
        <div className="px-4 pb-32">
          {/* Outfit name + reason */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{outfit.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{outfit.reason}</p>
          </div>

          {/* Item cards — vertical stack */}
          <div className="space-y-3">
            {outfit.items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex items-center gap-3"
              >
                <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                  <img
                    src={item.image_url}
                    alt={item.subcategory || item.category}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[item.category]}</span>
                    <span className="font-medium text-gray-800 text-sm">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {item.subcategory && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subcategory}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-full border border-gray-200"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-400">{item.color}</span>
                    {item.brand && (
                      <span className="text-xs text-gray-400">· {item.brand}</span>
                    )}
                  </div>
                </div>
                {item.wear_count === 0 && (
                  <span className="text-[10px] bg-clossie-50 text-clossie-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    New
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons — fixed at bottom */}
          <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 pt-3 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
            {outfit.wornToday ? (
              <div className="w-full py-3.5 bg-green-50 text-green-600 rounded-2xl font-semibold text-center text-sm">
                Wearing this today ✓
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleWearIt}
                  className="flex-1 py-3.5 bg-clossie-600 text-white rounded-2xl font-semibold text-sm active:scale-[0.98] transition shadow-lg shadow-clossie-200"
                >
                  Wear This Today
                </button>
                <button
                  onClick={handleSave}
                  disabled={outfit.saved}
                  className={`px-4 py-3.5 rounded-2xl text-sm font-semibold transition ${
                    outfit.saved
                      ? 'bg-green-50 text-green-600'
                      : 'bg-white border border-gray-200 text-gray-700 active:scale-95'
                  }`}
                >
                  {outfit.saved ? '✓' : 'Save'}
                </button>
              </div>
            )}
            <button
              onClick={() => { autoTriggered.current = false; handleGenerate(); }}
              className="w-full mt-2 py-2 text-clossie-600 text-sm font-medium"
            >
              Shuffle — show me another
            </button>
          </div>
        </div>
      )}

      {/* Waiting for items to load */}
      {itemsLoading && !loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
