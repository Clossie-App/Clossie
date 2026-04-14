'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ClothingItem, ClothingCategory } from '@/lib/types';

export function useClothingItems(category?: ClothingCategory) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('clothing_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (!error && data) {
      setItems(data as ClothingItem[]);
    }
    setLoading(false);
  }, [user, category]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(async (item: Omit<ClothingItem, 'id' | 'user_id' | 'wear_count' | 'last_worn_at' | 'created_at'>) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('clothing_items')
      .insert({
        ...item,
        user_id: user.id,
        wear_count: 0,
      })
      .select()
      .single();

    if (!error && data) {
      setItems((prev) => [data as ClothingItem, ...prev]);
      return data as ClothingItem;
    }
    return null;
  }, [user, supabase]);

  const updateItem = useCallback(async (id: string, updates: Partial<ClothingItem>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('clothing_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      setItems((prev) => prev.map((item) => (item.id === id ? (data as ClothingItem) : item)));
      return data as ClothingItem;
    }
    return null;
  }, [user, supabase]);

  const deleteItem = useCallback(async (id: string) => {
    if (!user) return false;
    const { error } = await supabase.from('clothing_items').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    return !error;
  }, [user, supabase]);

  return { items, loading, fetchItems, addItem, updateItem, deleteItem };
}
