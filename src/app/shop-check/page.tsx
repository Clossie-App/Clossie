'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useOutfits } from '@/hooks/useOutfits';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import { ClothingItem, CATEGORY_ICONS, CATEGORY_LABELS } from '@/lib/types';
import { compressImage } from '@/lib/image-compression';
import Link from 'next/link';

const LOADING_MESSAGES = [
  'Searching your wardrobe...',
  'Comparing styles...',
  'Analyzing your closet...',
  'Checking for matches...',
];

interface ShopCheckResult {
  match_found: boolean;
  item_analysis: string;
  similar_item_ids: string[];
  suggested_outfit: { name: string; item_ids: string[]; reason: string } | null;
  gap_analysis: string | null;
  outfit_unlock_count: number | null;
}

export default function ShopCheckPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading: itemsLoading } = useClothingItems();
  const { createOutfit } = useOutfits();
  const { showToast } = useToast();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [result, setResult] = useState<ShopCheckResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!loading) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image too large. Max 15MB.', 'error');
      return;
    }

    try {
      const compressed = await compressImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setImageBase64(base64);
        setResult(null);
      };
      reader.readAsDataURL(compressed);
    } catch {
      showToast('Could not process image.', 'error');
    }
  };

  const handleCheck = async () => {
    if (!imageBase64 || items.length === 0) return;
    setLoading(true);
    setResult(null);
    setLoadingMsg(LOADING_MESSAGES[0]);

    const available = items.filter((i) => !i.in_laundry && !i.is_wishlist);
    const compactItems = available.map((i) => ({
      id: i.id,
      category: i.category,
      subcategory: i.subcategory,
      color: i.color,
      secondary_color: i.secondary_color,
      season: i.season,
      occasion: i.occasion,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/ai/shop-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ imageBase64, items: compactItems }),
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('Failed');

      const data: ShopCheckResult = await res.json();
      setResult(data);
      haptics.success();
    } catch {
      clearTimeout(timeout);
      showToast('Could not analyze. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!result?.suggested_outfit) return;
    haptics.success();
    const saved = await createOutfit(
      result.suggested_outfit.name,
      result.suggested_outfit.item_ids
    );
    if (saved) {
      showToast(`"${result.suggested_outfit.name}" saved!`, 'success');
    } else {
      showToast('Could not save outfit.', 'error');
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const itemMap = new Map(items.map((i) => [i.id, i]));

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-32">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => router.back()} aria-label="Go back" className="text-gray-400 text-sm mb-2">{'\u2190'} Back</button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shop Your Closet First</h1>
        <p className="text-sm text-gray-400 mt-1">Before you buy, let&apos;s check what you already own</p>
      </div>

      <div className="px-4">
        {/* Upload zone */}
        {!imagePreview && (
          <div className="mt-4">
            <label className="block bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-clossie-300 p-8 text-center cursor-pointer active:scale-[0.98] transition-transform">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="text-4xl mb-3">{'\u{1F4F8}'}</div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                Upload or snap the item you&apos;re thinking of buying
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Screenshot from a website, photo from a store, or a saved image
              </p>
            </label>
          </div>
        )}

        {/* Image preview */}
        {imagePreview && !loading && !result && (
          <div className="mt-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <img
                src={imagePreview}
                alt="Item to check"
                className="w-full h-64 object-contain bg-gray-50 dark:bg-gray-800"
              />
              <div className="p-4 flex gap-2">
                <button
                  onClick={handleCheck}
                  disabled={itemsLoading}
                  className="flex-1 py-3 bg-clossie-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition"
                >
                  {itemsLoading ? 'Loading closet...' : 'Check My Closet'}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium"
                >
                  {'\u2715'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">{loadingMsg}</p>
          </div>
        )}

        {/* Result: Match Found */}
        {result && result.match_found && (
          <div className="mt-4 space-y-4">
            <div className="bg-green-50 dark:bg-green-950 rounded-2xl p-5 text-center border border-green-200 dark:border-green-800">
              <div className="text-4xl mb-2">{'\u{1F389}'}</div>
              <h2 className="text-lg font-bold text-green-700 dark:text-green-400">You already own this vibe!</h2>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">{result.item_analysis}</p>
            </div>

            {/* Similar items */}
            {result.similar_item_ids.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 px-1">Similar items you own</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {result.similar_item_ids.map((id) => {
                    const item = itemMap.get(id);
                    if (!item) return null;
                    return (
                      <Link key={id} href={`/closet/${id}`} className="flex-shrink-0">
                        <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                          <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested outfit */}
            {result.suggested_outfit && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">{result.suggested_outfit.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{result.suggested_outfit.reason}</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {result.suggested_outfit.item_ids.map((id) => {
                    const item = itemMap.get(id);
                    if (!item) return null;
                    return (
                      <div key={id} className="flex-shrink-0 w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleSaveOutfit}
                  className="mt-3 w-full py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition"
                >
                  Save This Outfit
                </button>
              </div>
            )}

            <button onClick={handleReset} className="w-full py-2 text-clossie-600 text-sm font-medium">
              Check another item
            </button>
          </div>
        )}

        {/* Result: Gap Found */}
        {result && !result.match_found && (
          <div className="mt-4 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-5 text-center border border-amber-200 dark:border-amber-800">
              <div className="text-4xl mb-2">{'\u{1F4A1}'}</div>
              <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">This fills a real gap!</h2>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">{result.item_analysis}</p>
            </div>

            {result.gap_analysis && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Why this is worth it</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{result.gap_analysis}</p>
                {result.outfit_unlock_count && (
                  <div className="mt-3 bg-clossie-50 dark:bg-clossie-950 rounded-xl p-3 text-center">
                    <span className="text-2xl font-bold text-clossie-600">~{result.outfit_unlock_count}</span>
                    <p className="text-xs text-clossie-500 mt-0.5">new outfits unlocked</p>
                  </div>
                )}
              </div>
            )}

            <Link
              href="/add"
              className="block w-full py-3 bg-clossie-600 text-white rounded-xl text-sm font-semibold text-center active:scale-[0.98] transition"
            >
              Add to Wishlist
            </Link>
            <button onClick={handleReset} className="w-full py-2 text-clossie-600 text-sm font-medium">
              Check another item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
