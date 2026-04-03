import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { chosen_item_ids, rejected_item_ids, chosen_colors, rejected_colors, chosen_categories, rejected_categories } = body;

    const { error } = await supabase
      .from('outfit_preferences')
      .insert({
        user_id: user.id,
        chosen_item_ids: chosen_item_ids || [],
        rejected_item_ids: rejected_item_ids || [],
        chosen_colors: chosen_colors || [],
        rejected_colors: rejected_colors || [],
        chosen_categories: chosen_categories || [],
        rejected_categories: rejected_categories || [],
      });

    if (error) {
      // Table may not exist yet — fail silently
      console.error('Preference insert error:', error.message);
      return NextResponse.json({ ok: true, logged: false });
    }

    return NextResponse.json({ ok: true, logged: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
