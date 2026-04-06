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

    // Validate all array fields: must be arrays of strings, max 50 entries each
    const validateArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val.filter((v): v is string => typeof v === 'string' && v.length <= 100).slice(0, 50);
    };

    const { error } = await supabase
      .from('outfit_preferences')
      .insert({
        user_id: user.id,
        chosen_item_ids: validateArray(chosen_item_ids),
        rejected_item_ids: validateArray(rejected_item_ids),
        chosen_colors: validateArray(chosen_colors),
        rejected_colors: validateArray(rejected_colors),
        chosen_categories: validateArray(chosen_categories),
        rejected_categories: validateArray(rejected_categories),
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
