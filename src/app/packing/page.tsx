'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useToast } from '@/lib/toast-context';
import { CATEGORY_ICONS } from '@/lib/types';
import { createClient } from '@/lib/supabase';


interface PackingList {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface PackingListItem {
  id: string;
  packing_list_id: string;
  clothing_item_id: string;
  packed: boolean;
}

const supabase = createClient(); // Module-scope singleton — no re-render loop

export default function PackingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items: closetItems } = useClothingItems();
  const { showToast } = useToast();

  const [lists, setLists] = useState<PackingList[]>([]);
  const [listItems, setListItems] = useState<PackingListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDest, setNewDest] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [addingItems, setAddingItems] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Load all packing lists on mount
  const fetchLists = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('packing_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setLists(data);
  }, [user]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  // Load items for the selected list
  const fetchListItems = useCallback(async () => {
    if (!selectedList) { setListItems([]); return; }
    const { data, error } = await supabase
      .from('packing_list_items')
      .select('*')
      .eq('packing_list_id', selectedList);
    if (!error && data) setListItems(data);
  }, [selectedList]);

  useEffect(() => { fetchListItems(); }, [fetchListItems]);

  const handleCreate = async () => {
    if (!newName.trim()) { showToast('Give your trip a name', 'error'); return; }
    if (!user) return;
    const { data, error } = await supabase
      .from('packing_lists')
      .insert({
        user_id: user.id,
        name: newName.trim(),
        destination: newDest.trim(),
        start_date: newStart || null,
        end_date: newEnd || null,
      })
      .select()
      .single();
    if (error) { showToast('Failed to create trip', 'error'); return; }
    setLists(prev => [data, ...prev]);
    setCreating(false);
    setSelectedList(data.id);
    setNewName(''); setNewDest(''); setNewStart(''); setNewEnd('');
    showToast('Trip created!', 'success');
  };

  const togglePacked = async (clothingItemId: string) => {
    const item = listItems.find(i => i.clothing_item_id === clothingItemId);
    if (!item) return;
    const { error } = await supabase
      .from('packing_list_items')
      .update({ packed: !item.packed })
      .eq('id', item.id);
    if (error) { showToast('Could not update. Try again.', 'error'); return; }
    setListItems(prev => prev.map(i => i.id === item.id ? { ...i, packed: !i.packed } : i));
  };

  const addItemToList = async (listId: string, clothingItemId: string) => {
    if (listItems.some(i => i.clothing_item_id === clothingItemId)) return;
    const { data, error } = await supabase
      .from('packing_list_items')
      .insert({ packing_list_id: listId, clothing_item_id: clothingItemId, packed: false })
      .select()
      .single();
    if (error) { showToast('Could not add item.', 'error'); return; }
    if (data) setListItems(prev => [...prev, data]);
  };

  const removeItemFromList = async (clothingItemId: string) => {
    const item = listItems.find(i => i.clothing_item_id === clothingItemId);
    if (!item) return;
    const { error } = await supabase
      .from('packing_list_items')
      .delete()
      .eq('id', item.id);
    if (error) { showToast('Could not remove item.', 'error'); return; }
    setListItems(prev => prev.filter(i => i.id !== item.id));
  };

  const deleteList = async (listId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('packing_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', user.id);
    if (error) { showToast('Could not delete trip.', 'error'); return; }
    setLists(prev => prev.filter(l => l.id !== listId));
    setSelectedList(null);
    setListItems([]);
    showToast('Trip deleted', 'info');
  };

  const active = selectedList ? lists.find(l => l.id === selectedList) : null;
  const closetMap = new Map(closetItems.map(i => [i.id, i]));

  if (authLoading) return null;

  // List detail view
  if (active) {
    const packedCount = listItems.filter(i => i.packed).length;
    const totalCount = listItems.length;
    const progress = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => { setSelectedList(null); setAddingItems(false); }} className="text-gray-400 p-1" aria-label="Go back">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{active.name}</h1>
            <button onClick={() => setAddingItems(!addingItems)} className="text-clossie-600 text-sm font-medium">
              {addingItems ? 'Done' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Trip info */}
        <div className="px-4 py-3">
          {active.destination && <p className="text-sm text-gray-500 dark:text-gray-400">{active.destination}</p>}
          {active.start_date && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {new Date(active.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {active.end_date && ` — ${new Date(active.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{packedCount} of {totalCount} packed</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-clossie-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Add items from closet */}
        {addingItems && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tap items from your closet to add:</p>
            <div className="grid grid-cols-5 gap-2">
              {closetItems.filter(ci => !listItems.some(ai => ai.clothing_item_id === ci.id)).map(ci => (
                <button key={ci.id} onClick={() => addItemToList(active.id, ci.id)}
                  className="aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                  <img src={ci.image_url} alt={ci.category} className="w-full h-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Packing checklist */}
        <div className="px-4 py-2">
          {listItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🧳</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">No items yet — tap + Add to start packing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listItems.map(pi => {
                const item = closetMap.get(pi.clothing_item_id);
                if (!item) return null;
                return (
                  <div key={pi.clothing_item_id} className={`flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 transition ${pi.packed ? 'opacity-60' : ''}`}>
                    <button onClick={() => togglePacked(pi.clothing_item_id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        pi.packed ? 'bg-clossie-600 border-clossie-600' : 'border-gray-300'
                      }`}>
                      {pi.packed && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${pi.packed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {CATEGORY_ICONS[item.category]} {item.subcategory || item.category}
                      </p>
                      {item.color && <p className="text-xs text-gray-400 dark:text-gray-500">{item.color}</p>}
                    </div>
                    <button onClick={() => removeItemFromList(pi.clothing_item_id)} className="text-gray-300 p-1" aria-label="Remove item">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete trip */}
        <div className="px-4 py-6">
          <button onClick={() => deleteList(active.id)} className="w-full text-red-400 dark:text-red-500 text-sm font-medium py-2">
            Delete Trip
          </button>
        </div>
      </div>
    );
  }

  // List overview
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Packing Lists</h1>
          <button onClick={() => setCreating(true)} className="px-4 py-2 bg-clossie-600 text-white rounded-xl text-sm font-semibold">
            + New Trip
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Create form */}
        {creating && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Trip name (e.g., Miami Weekend)" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800" />
            <input type="text" value={newDest} onChange={e => setNewDest(e.target.value)}
              placeholder="Destination (optional)" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800" />
            <div className="flex gap-2">
              <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800" />
              <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold">Create</button>
            </div>
          </div>
        )}

        {/* Existing lists */}
        {lists.length === 0 && !creating ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🧳</p>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No packing lists yet</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Create a trip and pack your outfits</p>
          </div>
        ) : (
          lists.map(list => (
            <button key={list.id} onClick={() => setSelectedList(list.id)}
              className="w-full bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-left">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">{list.name}</h3>
              </div>
              {list.destination && <p className="text-xs text-gray-400 dark:text-gray-500">{list.destination}</p>}
              {list.start_date && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(list.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {list.end_date && ` — ${new Date(list.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
