'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useOutfits } from '@/hooks/useOutfits';
import { Outfit, OCCASION_LABELS, SEASON_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';

export default function OutfitsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { outfits, loading, logWear } = useOutfits();
  const { showToast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Outfits</h1>
          <Link
            href="/outfits/builder"
            className="px-4 py-2 bg-clossie-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
          >
            + New Outfit
          </Link>
        </div>
      </div>

      {/* Outfits list */}
      <div className="p-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
          ))
        ) : outfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">&#x2728;</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No outfits yet</h3>
            <p className="text-gray-400 text-center text-sm mb-4">
              Combine your closet items into outfits
            </p>
            <div className="flex gap-3">
              <Link
                href="/outfits/builder"
                className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
              >
                Build Manually
              </Link>
              <Link
                href="/outfits/suggest"
                className="px-5 py-3 bg-clossie-600 text-white rounded-xl font-semibold text-sm"
              >
                AI Suggest
              </Link>
            </div>
          </div>
        ) : (
          <>
          {/* AI Suggest entry card */}
          <Link
            href="/outfits/suggest"
            className="block bg-clossie-50 rounded-2xl p-4 border border-clossie-100 active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x2728;</span>
              <div>
                <p className="font-semibold text-clossie-700 text-sm">Get AI Outfit Ideas</p>
                <p className="text-xs text-clossie-500">Let AI style your closet items into outfits</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-clossie-400 ml-auto">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
          {outfits.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} onLogWear={async () => { await logWear(outfit.id); showToast(`Logged "${outfit.name}" — nice fit! 🔥`, 'success'); }} />
          ))}
          </>
        )}
      </div>
    </div>
  );
}

function OutfitCard({ outfit, onLogWear }: { outfit: Outfit; onLogWear: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">{outfit.name}</h3>
            <div className="flex gap-2 mt-1">
              {outfit.occasion && (
                <span className="text-xs bg-clossie-50 text-clossie-600 px-2 py-0.5 rounded-full">
                  {OCCASION_LABELS[outfit.occasion]}
                </span>
              )}
              {outfit.season && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {SEASON_LABELS[outfit.season]}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onLogWear}
            className="px-3 py-1.5 bg-clossie-50 text-clossie-600 rounded-xl text-xs font-medium active:scale-95 transition"
          >
            Wore it!
          </button>
        </div>

        {/* Item thumbnails */}
        {outfit.items && outfit.items.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
            {outfit.items.map((item) => (
              <div
                key={item.id}
                className="w-16 h-16 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100"
              >
                <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
