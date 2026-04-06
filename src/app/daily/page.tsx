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
import { MOODS, getRandomMood, Mood } from '@/lib/moods';
import { getSeasonFromMonth } from '@/lib/date-utils';
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

const DAILY_MESSAGES = [
  'Matching your mood...',
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
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  const greeting = getGreeting();
  const currentSeason = getSeasonFromMonth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

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

  const handleMoodSelect = (mood: Mood) => {
    haptics.light();
    setSelectedMood(mood);
    handleGenerate(mood);
  };

  const handleSurpriseMe = () => {
    haptics.light();
    const randomMood = getRandomMood();
    setSelectedMood(randomMood);
    handleGenerate(randomMood);
  };

  const handleGenerate = async (mood?: Mood) => {
    setLoading(true);
    setError('');
    setOutfit(null);
    setLoadingMsg(DAILY_MESSAGES[0]);

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
        body: JSON.stringify({
          items: compactItems,
          season: currentSeason,
          preferUnworn: true,
          mood: mood?.id,
          count: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
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
        setError('Could not build an outfit. Try a different mood!');
      } else {
        setOutfit(resolved[0]);
        if (mood) {
          fetch('/api/mood-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood: mood.id }),
          }).catch(() => {});
        }
      }
    } catch {
      clearTimeout(timeout);
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

  const handleShuffle = () => {
    if (selectedMood) {
      handleGenerate(selectedMood);
    } else {
      handleSurpriseMe();
    }
  };

  const handleBackToMoods = () => {
    setSelectedMood(null);
    setOutfit(null);
    setError('');
  };

  if (authLoading) return null;

  // Not enough items
  if (!itemsLoading && availableItems.length < 5) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="px-6 pt-12 pb-6">
          <p className="text-gray-400 text-sm">{greeting}{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Today&apos;s Outfit</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="text-5xl mb-4">{'\u{1F457}'}</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Need more items</h3>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          {outfit || loading ? 'Today\u2019s Outfit' : 'How do you want to feel?'}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Mood Selector Grid — shown when no outfit generated yet */}
      {!outfit && !loading && !error && !itemsLoading && (
        <div className="px-4 pb-32">
          {/* Mood cards grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => handleMoodSelect(mood)}
                className={`bg-gradient-to-br ${mood.gradient} rounded-2xl p-4 text-left text-white active:scale-95 transition-transform shadow-sm`}
              >
                <div className="text-3xl mb-2">{mood.emoji}</div>
                <div className="font-bold text-sm">{mood.label}</div>
                <div className="text-[11px] opacity-90 mt-0.5">{mood.description}</div>
              </button>
            ))}
          </div>

          {/* Surprise Me */}
          <button
            onClick={handleSurpriseMe}
            className="w-full bg-white dark:bg-gray-900 border-2 border-dashed border-clossie-300 rounded-2xl p-4 text-center active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">{'\u{1F3B2}'}</span>
            <div className="font-bold text-sm text-gray-700 dark:text-gray-300 mt-1">Surprise Me</div>
            <div className="text-[11px] text-gray-400">Pick a random mood</div>
          </button>

          {/* Quick Duel entry */}
          <Link
            href="/duels"
            className="mt-4 block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <span className="text-xl">{'\u{2694}\uFE0F'}</span>
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 ml-2">Quick Duel</span>
            <span className="text-[11px] text-gray-400 ml-1">Which outfit wins?</span>
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          {selectedMood && (
            <div className={`w-16 h-16 bg-gradient-to-br ${selectedMood.gradient} rounded-full flex items-center justify-center text-3xl mb-4 animate-pulse`}>
              {selectedMood.emoji}
            </div>
          )}
          {!selectedMood && (
            <div className="w-12 h-12 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          )}
          <p className="text-gray-600 dark:text-gray-400 font-medium">{loadingMsg}</p>
          {selectedMood && (
            <p className="text-gray-400 text-xs mt-1">Feeling {selectedMood.label.toLowerCase()} today</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-6 py-16">
          <div className="bg-red-50 dark:bg-red-950 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">{'\u{1F615}'}</div>
            <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleBackToMoods}
                className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700"
              >
                Pick Another Mood
              </button>
              <button
                onClick={handleShuffle}
                className="px-5 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's outfit */}
      {outfit && !loading && (
        <div className="px-4 pb-32">
          {/* Mood badge */}
          {selectedMood && (
            <div className="flex justify-center mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${selectedMood.gradient} text-white text-xs font-medium`}>
                <span>{selectedMood.emoji}</span>
                {selectedMood.label}
              </span>
            </div>
          )}

          {/* Outfit name + reason */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{outfit.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{outfit.reason}</p>
          </div>

          {/* Item cards */}
          <div className="space-y-3">
            {outfit.items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3"
              >
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <img
                    src={item.image_url}
                    alt={item.subcategory || item.category}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[item.category]}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {item.subcategory && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subcategory}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-full border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-400">{item.color}</span>
                    {item.brand && (
                      <span className="text-xs text-gray-400">{'\u00B7'} {item.brand}</span>
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

          {/* Action buttons */}
          <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 pt-3 bg-gradient-to-t from-gray-50 dark:from-gray-950 via-gray-50 dark:via-gray-950 to-transparent">
            {outfit.wornToday ? (
              <div className="w-full py-3.5 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-2xl font-semibold text-center text-sm">
                Wearing this today {'\u2713'}
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
                      ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 active:scale-95'
                  }`}
                >
                  {outfit.saved ? '\u2713' : 'Save'}
                </button>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleBackToMoods}
                className="flex-1 py-2 text-gray-500 text-sm font-medium"
              >
                {'\u2190'} Change Mood
              </button>
              <button
                onClick={handleShuffle}
                className="flex-1 py-2 text-clossie-600 text-sm font-medium"
              >
                Shuffle {'\u{1F500}'}
              </button>
            </div>
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
