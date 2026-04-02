'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase';
import { ClothingItem, CATEGORY_LABELS, CATEGORY_ICONS, SEASON_LABELS, OCCASION_LABELS } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';

export default function ItemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!user || !id) return;

    supabase
      .from('clothing_items')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setItem(data as ClothingItem);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!item) return;
    const { data } = await supabase
      .from('clothing_items')
      .update({ is_favorite: !item.is_favorite })
      .eq('id', item.id)
      .select()
      .single();
    if (data) { setItem(data as ClothingItem); showToast(data.is_favorite ? 'Added to favorites ❤️' : 'Removed from favorites', 'info'); }
  };

  const toggleLaundry = async () => {
    if (!item) return;
    const { data } = await supabase
      .from('clothing_items')
      .update({ in_laundry: !item.in_laundry })
      .eq('id', item.id)
      .select()
      .single();
    if (data) { setItem(data as ClothingItem); showToast(data.in_laundry ? 'Marked as in laundry 🧺' : 'Removed from laundry', 'info'); }
  };

  const handleDelete = async () => {
    if (!item) return;
    const { error } = await supabase.from('clothing_items').delete().eq('id', item.id);
    if (error) { showToast('Could not delete item. Try again.', 'error'); return; }
    haptics.error();
    showToast('Item deleted', 'info');
    router.push('/closet');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-500">Item not found</p>
        <button onClick={() => router.push('/closet')} className="text-clossie-600 mt-2">
          Back to Closet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 p-1" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {CATEGORY_ICONS[item.category]} {CATEGORY_LABELS[item.category]}
          </h1>
          <button onClick={toggleFavorite} className="p-1 text-xl" aria-label={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
            {item.is_favorite ? '\u2764\uFE0F' : '\u2661'}
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="bg-white p-6 flex justify-center">
        <div className="w-64 h-64 rounded-3xl overflow-hidden bg-gray-50">
          <img src={item.image_url} alt={`${item.subcategory || item.category}${item.color ? ` in ${item.color}` : ''}`} className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={toggleLaundry}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
            item.in_laundry
              ? 'bg-blue-100 text-blue-600'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {item.in_laundry ? '\uD83E\uDDFA In Laundry' : '\uD83E\uDDFA Mark as Laundry'}
        </button>
        <button
          onClick={() => router.push(`/outfits/builder?item=${item.id}`)}
          className="flex-1 py-2.5 bg-clossie-100 text-clossie-700 rounded-xl text-sm font-medium"
        >
          Build Outfit
        </button>
        <button
          onClick={() => router.push(`/outfits/suggest?item=${item.id}`)}
          className="flex-1 py-2.5 bg-clossie-50 text-clossie-700 rounded-xl text-sm font-medium"
        >
          Style This
        </button>
      </div>

      {/* Details */}
      <div className="px-4 space-y-3 mt-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <Detail label="Category" value={`${CATEGORY_ICONS[item.category]} ${CATEGORY_LABELS[item.category]}`} />
            {item.subcategory && <Detail label="Type" value={item.subcategory} />}
            <Detail label="Season" value={SEASON_LABELS[item.season]} />
            <Detail label="Occasion" value={OCCASION_LABELS[item.occasion]} />
            <Detail label="Color" value={item.color} color={item.color} />
            <Detail label="Times Worn" value={String(item.wear_count)} />
            {item.brand && <Detail label="Brand" value={item.brand} />}
            {item.size && <Detail label="Size" value={item.size} />}
            {item.price != null && <Detail label="Price" value={`$${item.price.toFixed(2)}`} />}
            {item.price != null && item.wear_count > 0 && (
              <Detail label="Cost/Wear" value={`$${(item.price / item.wear_count).toFixed(2)}`} />
            )}
          </div>
          {item.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Notes</p>
              <p className="text-sm text-gray-700 mt-1">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="pt-2 pb-6">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 text-red-400 text-sm font-medium"
            >
              Delete Item
            </button>
          ) : (
            <div className="bg-red-50 rounded-2xl p-4 text-center">
              <p className="text-red-600 text-sm mb-3">Remove this item from your closet?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-white rounded-xl text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {color && (
          <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: color }} />
        )}
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
