import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TRYON_SERVER = 'http://localhost:5001';

export async function POST(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { imageBase64, description } = await request.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Missing imageBase64' }, { status: 400 });
    }

    // Check if the try-on server is running
    try {
      const health = await fetch(`${TRYON_SERVER}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!health.ok) throw new Error('Server not healthy');
    } catch {
      return NextResponse.json({
        error: 'Try-on server not running. Start it with: bash scripts/start-tryon.sh',
        serverOffline: true,
      }, { status: 503 });
    }

    // Call the local MLX try-on server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2min timeout

    const response = await fetch(`${TRYON_SERVER}/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        description: description || 'clothing item',
        strength: 0.7,
        steps: 20,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[TryOn] Server error:', response.status);
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }

    const result = await response.json();
    if (!result.image) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    return NextResponse.json({
      image: result.image,
      timeSeconds: result.time_seconds,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json({ error: 'Generation timed out' }, { status: 504 });
    }
    console.error('[TryOn] Error:', error);
    return NextResponse.json({ error: 'Try-on failed' }, { status: 500 });
  }
}
