'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useOutfits } from '@/hooks/useOutfits';
import { CATEGORY_LABELS, CATEGORY_ICONS, ClothingCategory } from '@/lib/types';

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading: itemsLoading } = useClothingItems();
  const { outfits } = useOutfits();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const stats = useMemo(() => {
    if (items.length === 0) return null;

    const totalItems = items.length;
    const totalOutfits = outfits.length;
    const totalWears = items.reduce((sum, i) => sum + i.wear_count, 0);
    const avgWears = totalWears / totalItems;
    const favorites = items.filter((i) => i.is_favorite).length;
    const inLaundry = items.filter((i) => i.in_laundry).length;

    // Category breakdown
    const categoryCount = new Map<ClothingCategory, number>();
    items.forEach((item) => {
      categoryCount.set(item.category, (categoryCount.get(item.category) || 0) + 1);
    });

    // Most worn
    const mostWorn = [...items].sort((a, b) => b.wear_count - a.wear_count).slice(0, 5);

    // Least worn (with at least one item)
    const leastWorn = [...items].sort((a, b) => a.wear_count - b.wear_count).slice(0, 5);

    // Not worn in 3+ months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const neglected = items.filter((item) => {
      if (!item.last_worn_at) return true;
      return new Date(item.last_worn_at) < threeMonthsAgo;
    });

    // Total value
    const totalValue = items.reduce((sum, i) => sum + (i.price || 0), 0);

    // Cost per wear (for items with price and wears)
    const costPerWear = items
      .filter((i) => i.price && i.wear_count > 0)
      .map((i) => ({ ...i, cpw: i.price! / i.wear_count }))
      .sort((a, b) => a.cpw - b.cpw);

    return {
      totalItems,
      totalOutfits,
      totalWears,
      avgWears,
      favorites,
      inLaundry,
      categoryCount,
      mostWorn,
      leastWorn,
      neglected,
      totalValue,
      costPerWear,
    };
  }, [items, outfits]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-700 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Closet Insights</h1>
      </div>

      {itemsLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : !stats ? (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">Your insights are waiting</h3>
          <p className="text-gray-400 dark:text-gray-500 text-center text-sm mb-5">
            Once you add items and log outfits, you'll see cost-per-wear, your most-worn pieces, and what's collecting dust.
          </p>
          <a
            href="/add"
            className="px-6 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
          >
            Add Your First Item
          </a>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Overview cards */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={stats.totalItems} label="Items" />
            <StatCard value={stats.totalOutfits} label="Outfits" />
            <StatCard value={stats.totalWears} label="Total Wears" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard value={stats.favorites} label="Favorites" />
            <StatCard value={stats.inLaundry} label="In Laundry" />
            <StatCard value={`$${stats.totalValue.toFixed(0)}`} label="Total Value" />
          </div>

          {/* Category breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Wardrobe Breakdown</h3>
            <div className="space-y-2">
              {Array.from(stats.categoryCount.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-sm w-28">
                      {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clossie-400 rounded-full"
                        style={{ width: `${(count / stats.totalItems) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Most worn */}
          {stats.mostWorn.length > 0 && stats.mostWorn[0].wear_count > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Most Worn</h3>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {stats.mostWorn.filter((i) => i.wear_count > 0).map((item) => (
                  <div key={item.id} className="flex-shrink-0 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                      <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.wear_count}x</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best cost per wear */}
          {stats.costPerWear.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Best Cost Per Wear</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Items giving you the most value</p>
              <div className="space-y-2">
                {stats.costPerWear.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.subcategory || CATEGORY_LABELS[item.category]}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">${item.price?.toFixed(2)} / {item.wear_count} wears</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">${item.cpw.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Neglected items */}
          {stats.neglected.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Collecting Dust</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Not worn in 3+ months. Donate or style them?</p>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {stats.neglected.slice(0, 10).map((item) => (
                  <div key={item.id} className="w-14 h-14 flex-shrink-0 bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 opacity-60">
                    <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
                  </div>
                ))}
                {stats.neglected.length > 10 && (
                  <div className="w-14 h-14 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">+{stats.neglected.length - 10}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
      <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
