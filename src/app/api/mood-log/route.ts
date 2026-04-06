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
    const { mood } = await request.json();
    if (!mood || typeof mood !== 'string') {
      return NextResponse.json({ error: 'Mood is required' }, { status: 400 });
    }

    const VALID_MOODS = ['powerful', 'cozy', 'main-character', 'professional-badass', 'casual-cool', 'date-night', 'weekend-warrior'];
    if (!VALID_MOODS.includes(mood)) {
      return NextResponse.json({ error: 'Invalid mood' }, { status: 400 });
    }

    const { error } = await supabase
      .from('mood_log')
      .insert({ user_id: user.id, mood });

    if (error) {
      // Table may not exist yet — fail silently for non-critical logging
      console.error('Mood log insert error:', error.message);
      return NextResponse.json({ ok: true, logged: false });
    }

    return NextResponse.json({ ok: true, logged: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
