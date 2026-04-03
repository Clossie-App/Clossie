import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 });
    }

    const imageArrayBuffer = await imageFile.arrayBuffer();

    // Try remove.bg first (paid, best quality)
    const removeBgKey = process.env.REMOVE_BG_API_KEY;
    if (removeBgKey) {
      const result = await tryRemoveBg(removeBgKey, imageFile);
      if (result) return new NextResponse(new Uint8Array(result), { headers: { 'Content-Type': 'image/png' } });
    }

    // Try free Hugging Face model (no key needed)
    const hfResult = await tryHuggingFace(imageArrayBuffer);
    if (hfResult) return new NextResponse(new Uint8Array(hfResult), { headers: { 'Content-Type': 'image/png' } });

    // Fallback: return original image
    return new NextResponse(new Uint8Array(imageArrayBuffer), {
      headers: { 'Content-Type': imageFile.type },
    });
  } catch (error) {
    console.error('Background removal error:', error);
    return NextResponse.json({ error: 'Failed to remove background' }, { status: 500 });
  }
}

async function tryRemoveBg(apiKey: string, imageFile: File): Promise<ArrayBuffer | null> {
  try {
    const bgFormData = new FormData();
    bgFormData.append('image_file', imageFile);
    bgFormData.append('size', 'regular');
    bgFormData.append('format', 'png');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: bgFormData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

async function tryHuggingFace(imageData: ArrayBuffer): Promise<ArrayBuffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      'https://api-inference.huggingface.co/models/briaai/RMBG-1.4',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: imageData as any,
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    // 503 means model is warming up — fall through to original image fallback
    if (!response.ok) {
      console.error('Hugging Face error:', response.status, response.status === 503 ? '(model loading)' : '');
      return null;
    }

    return await response.arrayBuffer();
  } catch (err: any) {
    if (err?.name === 'AbortError') console.error('Hugging Face timed out after 30s');
    return null;
  }
}
