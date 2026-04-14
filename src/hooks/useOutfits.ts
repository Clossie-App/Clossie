'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Outfit, ClothingItem } from '@/lib/types';

export function useOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchOutfits = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get outfits
    const { data: outfitData } = await supabase
      .from('outfits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!outfitData) {
      setLoading(false);
      return;
    }

    // Get outfit items for all outfits
    const outfitIds = outfitData.map((o) => o.id);
    let outfitItems: { outfit_id: string; clothing_item_id: string }[] = [];
    if (outfitIds.length > 0) {
      const { data } = await supabase
        .from('outfit_items')
        .select('outfit_id, clothing_item_id')
        .in('outfit_id', outfitIds);
      outfitItems = data || [];
    }

    // Get all referenced clothing items
    const clothingIds = [...new Set((outfitItems || []).map((oi) => oi.clothing_item_id))];
    let clothingData: ClothingItem[] = [];
    if (clothingIds.length > 0) {
      const { data } = await supabase
        .from('clothing_items')
        .select('*')
        .in('id', clothingIds);
      clothingData = (data || []) as ClothingItem[];
    }

    const clothingMap = new Map(clothingData.map((c) => [c.id, c]));

    // Assemble outfits with items
    const assembled = outfitData.map((outfit) => ({
      ...outfit,
      items: (outfitItems || [])
        .filter((oi) => oi.outfit_id === outfit.id)
        .map((oi) => clothingMap.get(oi.clothing_item_id))
        .filter(Boolean) as ClothingItem[],
    })) as Outfit[];

    setOutfits(assembled);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOutfits();
  }, [fetchOutfits]);

  const createOutfit = useCallback(async (
    name: string,
    itemIds: string[],
    occasion?: string,
    season?: string
  ) => {
    if (!user) return null;

    const { data: outfit, error } = await supabase
      .from('outfits')
      .insert({
        user_id: user.id,
        name,
        occasion: occasion || null,
        season: season || null,
        is_favorite: false,
      })
      .select()
      .single();

    if (error || !outfit) return null;

    // Add outfit items
    const outfitItemRows = itemIds.map((itemId) => ({
      outfit_id: outfit.id,
      clothing_item_id: itemId,
    }));

    const { error: itemsError } = await supabase.from('outfit_items').insert(outfitItemRows);
    if (itemsError) {
      await supabase.from('outfits').delete().eq('id', outfit.id);
      return null;
    }

    await fetchOutfits();
    return outfit;
  }, [user, supabase, fetchOutfits]);

  const deleteOutfit = useCallback(async (id: string) => {
    if (!user) return;
    const { error: itemsError } = await supabase.from('outfit_items').delete().eq('outfit_id', id);
    if (itemsError) console.error('Failed to delete outfit items:', itemsError);
    const { error } = await supabase.from('outfits').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      setOutfits((prev) => prev.filter((o) => o.id !== id));
    }
  }, [user, supabase]);

  const logWear = useCallback(async (outfitId: string): Promise<boolean> => {
    if (!user) return false;
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('wear_log').insert({
      user_id: user.id,
      outfit_id: outfitId,
      worn_date: today,
    });

    if (error) return false;

    // Update wear counts for items in this outfit
    const outfit = outfits.find((o) => o.id === outfitId);
    if (outfit?.items) {
      for (const item of outfit.items) {
        const { error: updateError } = await supabase
          .from('clothing_items')
          .update({
            wear_count: item.wear_count + 1,
            last_worn_at: today,
          })
          .eq('id', item.id);
        if (updateError) console.error('Failed to update wear count for', item.id, updateError);
      }
    }

    await fetchOutfits();
    return true;
  }, [user, supabase, outfits, fetchOutfits]);

  return { outfits, loading, fetchOutfits, createOutfit, deleteOutfit, logWear };
}
