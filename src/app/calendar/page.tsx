'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase';
import { Outfit, ClothingItem, SEASON_LABELS, OCCASION_LABELS, Season, Occasion } from '@/lib/types';

interface WearEntry {
  date: string;
  outfit: Outfit & { items: ClothingItem[] };
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [wearEntries, setWearEntries] = useState<WearEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchWearLog = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data: logs, error: logsError } = await supabase
      .from('wear_log')
      .select('*')
      .eq('user_id', user.id)
      .gte('worn_date', startDate)
      .lte('worn_date', endDate)
      .order('worn_date', { ascending: true });

    if (logsError) {
      console.error('Failed to fetch wear log:', logsError);
      setWearEntries([]);
      setLoading(false);
      return;
    }

    if (!logs || logs.length === 0) {
      setWearEntries([]);
      setLoading(false);
      return;
    }

    const outfitIds = [...new Set(logs.map((l) => l.outfit_id))];
    const { data: outfits } = await supabase
      .from('outfits')
      .select('*')
      .in('id', outfitIds);

    const { data: outfitItems } = await supabase
      .from('outfit_items')
      .select('outfit_id, clothing_item_id')
      .in('outfit_id', outfitIds);

    const clothingIds = [...new Set((outfitItems || []).map((oi) => oi.clothing_item_id))];
    let clothing: ClothingItem[] = [];
    if (clothingIds.length > 0) {
      const { data } = await supabase.from('clothing_items').select('*').in('id', clothingIds);
      clothing = (data || []) as ClothingItem[];
    }

    const clothingMap = new Map(clothing.map((c) => [c.id, c]));

    const entries: WearEntry[] = logs.map((log) => {
      const outfit = (outfits || []).find((o) => o.id === log.outfit_id);
      const items = (outfitItems || [])
        .filter((oi) => oi.outfit_id === log.outfit_id)
        .map((oi) => clothingMap.get(oi.clothing_item_id))
        .filter(Boolean) as ClothingItem[];

      return {
        date: log.worn_date,
        outfit: { ...outfit, items } as WearEntry['outfit'],
      };
    });

    setWearEntries(entries);
    setLoading(false);
  }, [user, currentMonth]);

  useEffect(() => {
    fetchWearLog();
  }, [fetchWearLog]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const getEntryForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return wearEntries.find((e) => e.date === dateStr);
  };

  const selectedEntry = selectedDate ? wearEntries.find((e) => e.date === selectedDate) : null;

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">What I Wore</h1>
      </div>

      {/* Month navigation */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <button onClick={prevMonth} className="p-2 text-gray-400 dark:text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 text-gray-400 dark:text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-gray-800 px-4 pb-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-2 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entry = getEntryForDate(day);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition relative ${
                  isSelected
                    ? 'bg-clossie-600 text-white'
                    : isToday
                    ? 'bg-clossie-50 dark:bg-clossie-900/20 text-clossie-600 dark:text-clossie-400 font-bold'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {day}
                {entry && !isSelected && (
                  <div className="w-1.5 h-1.5 bg-clossie-400 rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty month nudge */}
      {!loading && wearEntries.length === 0 && !selectedDate && (
        <div className="mx-4 mt-3 bg-clossie-50 dark:bg-clossie-900/20 rounded-2xl p-4 text-center border border-clossie-100 dark:border-clossie-800">
          <p className="text-sm font-medium text-clossie-700 dark:text-clossie-300 mb-0.5">No outfits logged this month</p>
          <p className="text-xs text-clossie-400 dark:text-clossie-500">Tap &quot;Wore it!&quot; on any outfit to start tracking</p>
        </div>
      )}

      {/* Selected date detail */}
      {selectedDate && (
        <div className="px-4 py-3">
          {selectedEntry ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{selectedEntry.outfit.name}</h3>
              <div className="flex gap-1.5 mb-3">
                {selectedEntry.outfit.season && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                    {SEASON_LABELS[selectedEntry.outfit.season as Season] || selectedEntry.outfit.season}
                  </span>
                )}
                {selectedEntry.outfit.occasion && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                    {OCCASION_LABELS[selectedEntry.outfit.occasion as Occasion] || selectedEntry.outfit.occasion}
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {selectedEntry.outfit.items.map((item) => (
                  <div key={item.id} className="w-16 h-16 flex-shrink-0 bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden">
                    <img src={item.image_url} alt={item.subcategory || item.category} className="w-full h-full object-contain" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No outfit logged for this day</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
