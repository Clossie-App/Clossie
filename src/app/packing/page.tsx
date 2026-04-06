'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useClothingItems } from '@/hooks/useClothingItems';
import { useToast } from '@/lib/toast-context';
import { CATEGORY_ICONS, ClothingItem } from '@/lib/types';
import Link from 'next/link';

interface PackingList {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  items: { itemId: string; packed: boolean }[];
  createdAt: string;
}

function loadLists(): PackingList[] {
  try { return JSON.parse(localStorage.getItem('clossie-packing') || '[]'); } catch { return []; }
}

function saveLists(lists: PackingList[]) {
  try { localStorage.setItem('clossie-packing', JSON.stringify(lists)); } catch {}
}

export default function PackingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items: closetItems } = useClothingItems();
  const { showToast } = useToast();

  const [lists, setLists] = useState<PackingList[]>([]);
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

  useEffect(() => { setLists(loadLists()); }, []);

  const handleCreate = () => {
    if (!newName.trim()) { showToast('Give your trip a name', 'error'); return; }
    const list: PackingList = {
      id: `pack-${Date.now()}`,
      name: newName.trim(),
      destination: newDest.trim(),
      startDate: newStart,
      endDate: newEnd,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [list, ...lists];
    setLists(updated);
    saveLists(updated);
    setCreating(false);
    setSelectedList(list.id);
    setNewName(''); setNewDest(''); setNewStart(''); setNewEnd('');
    showToast('Trip created!', 'success');
  };

  const togglePacked = (listId: string, itemId: string) => {
    const updated = lists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map(i => i.itemId === itemId ? { ...i, packed: !i.packed } : i) };
    });
    setLists(updated);
    saveLists(updated);
  };

  const addItemToList = (listId: string, itemId: string) => {
    const updated = lists.map(l => {
      if (l.id !== listId) return l;
      if (l.items.some(i => i.itemId === itemId)) return l;
      return { ...l, items: [...l.items, { itemId, packed: false }] };
    });
    setLists(updated);
    saveLists(updated);
  };

  const removeItemFromList = (listId: string, itemId: string) => {
    const updated = lists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.filter(i => i.itemId !== itemId) };
    });
    setLists(updated);
    saveLists(updated);
  };

  const deleteList = (listId: string) => {
    const updated = lists.filter(l => l.id !== listId);
    setLists(updated);
    saveLists(updated);
    setSelectedList(null);
    showToast('Trip deleted', 'info');
  };

  const active = selectedList ? lists.find(l => l.id === selectedList) : null;
  const closetMap = new Map(closetItems.map(i => [i.id, i]));

  if (authLoading) return null;

  // List detail view
  if (active) {
    const packedCount = active.items.filter(i => i.packed).length;
    const totalCount = active.items.length;
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
          {active.destination && <p className="text-sm text-gray-500">{active.destination}</p>}
          {active.startDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(active.startDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {active.endDate && ` — ${new Date(active.endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{packedCount} of {totalCount} packed</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-clossie-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Add items from closet */}
        {addingItems && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Tap items from your closet to add:</p>
            <div className="grid grid-cols-5 gap-2">
              {closetItems.filter(ci => !active.items.some(ai => ai.itemId === ci.id)).map(ci => (
                <button key={ci.id} onClick={() => addItemToList(active.id, ci.id)}
                  className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white">
                  <img src={ci.image_url} alt={ci.category} className="w-full h-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Packing checklist */}
        <div className="px-4 py-2">
          {active.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🧳</p>
              <p className="text-gray-400 text-sm">No items yet — tap + Add to start packing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.items.map(pi => {
                const item = closetMap.get(pi.itemId);
                if (!item) return null;
                return (
                  <div key={pi.itemId} className={`flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 transition ${pi.packed ? 'opacity-60' : ''}`}>
                    <button onClick={() => togglePacked(active.id, pi.itemId)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        pi.packed ? 'bg-clossie-600 border-clossie-600' : 'border-gray-300'
                      }`}>
                      {pi.packed && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                    <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={item.image_url} alt={item.category} className="w-full h-full object-contain" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${pi.packed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {CATEGORY_ICONS[item.category]} {item.subcategory || item.category}
                      </p>
                      {item.color && <p className="text-xs text-gray-400">{item.color}</p>}
                    </div>
                    <button onClick={() => removeItemFromList(active.id, pi.itemId)} className="text-gray-300 p-1">
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
          <button onClick={() => deleteList(active.id)} className="w-full text-red-400 text-sm font-medium py-2">
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
              placeholder="Trip name (e.g., Miami Weekend)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white" />
            <input type="text" value={newDest} onChange={e => setNewDest(e.target.value)}
              placeholder="Destination (optional)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white" />
            <div className="flex gap-2">
              <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white" />
              <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold">Create</button>
            </div>
          </div>
        )}

        {/* Existing lists */}
        {lists.length === 0 && !creating ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🧳</p>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No packing lists yet</h3>
            <p className="text-gray-400 text-sm mb-4">Create a trip and pack your outfits</p>
          </div>
        ) : (
          lists.map(list => {
            const packed = list.items.filter(i => i.packed).length;
            const total = list.items.length;
            return (
              <button key={list.id} onClick={() => setSelectedList(list.id)}
                className="w-full bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-left">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">{list.name}</h3>
                  {total > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      packed === total ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {packed}/{total}
                    </span>
                  )}
                </div>
                {list.destination && <p className="text-xs text-gray-400">{list.destination}</p>}
                {list.startDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(list.startDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {list.endDate && ` — ${new Date(list.endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
