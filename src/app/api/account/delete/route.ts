import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // Verify the authenticated user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Require confirmation text
  const { confirmation } = await request.json();
  if (confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
  }

  const errors: string[] = [];

  try {
    // Delete in dependency order: children first, then parents
    // 1. Wear logs
    const { error: wearLogErr } = await supabase.from('wear_log').delete().eq('user_id', user.id);
    if (wearLogErr) errors.push(`wear_log: ${wearLogErr.message}`);

    // 2. Outfit items (via outfit IDs)
    const { data: userOutfits, error: outfitQueryErr } = await supabase.from('outfits').select('id').eq('user_id', user.id);
    if (outfitQueryErr) errors.push(`outfits query: ${outfitQueryErr.message}`);
    if (userOutfits && userOutfits.length > 0) {
      const { error: outfitItemsErr } = await supabase.from('outfit_items').delete().in('outfit_id', userOutfits.map(o => o.id));
      if (outfitItemsErr) errors.push(`outfit_items: ${outfitItemsErr.message}`);
    }

    // 3. Outfits
    const { error: outfitsErr } = await supabase.from('outfits').delete().eq('user_id', user.id);
    if (outfitsErr) errors.push(`outfits: ${outfitsErr.message}`);

    // 4. Storage files
    const { data: imageFiles, error: storageListErr } = await supabase.storage.from('clothing-images').list(user.id);
    if (storageListErr) errors.push(`storage list: ${storageListErr.message}`);
    if (imageFiles && imageFiles.length > 0) {
      const { error: storageRemoveErr } = await supabase.storage.from('clothing-images').remove(imageFiles.map(f => `${user.id}/${f.name}`));
      if (storageRemoveErr) errors.push(`storage remove: ${storageRemoveErr.message}`);
    }

    // 5. Packing lists (cascade deletes packing_list_items)
    const { error: packingErr } = await supabase.from('packing_lists').delete().eq('user_id', user.id);
    if (packingErr) errors.push(`packing_lists: ${packingErr.message}`);

    // 6. Clothing items
    const { error: clothingErr } = await supabase.from('clothing_items').delete().eq('user_id', user.id);
    if (clothingErr) errors.push(`clothing_items: ${clothingErr.message}`);

    // Only delete auth user if all data cleanup succeeded
    if (errors.length > 0) {
      console.error('Account data cleanup errors (auth user NOT deleted):', errors);
      return NextResponse.json(
        { error: 'Some data could not be deleted. Your account was preserved. Please try again or contact support.', details: errors },
        { status: 500 }
      );
    }

    // 7. Delete auth user (requires service role)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(user.id);
      if (authDeleteErr) {
        console.error('Auth user deletion failed:', authDeleteErr);
        return NextResponse.json(
          { error: 'Data deleted but account removal failed. Contact support.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
