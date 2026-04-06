import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CompactItem {
  id: string;
  category: string;
  subcategory: string | null;
  color: string;
  secondary_color: string | null;
  season: string;
  occasion: string;
}

function sanitize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/["\\\n\r]/g, '').slice(0, 100);
}

function buildPrompt(items: CompactItem[]): string {
  const safeItems = items.map((i) => ({
    id: sanitize(i.id),
    category: sanitize(i.category),
    subcategory: sanitize(i.subcategory),
    color: sanitize(i.color),
    secondary_color: sanitize(i.secondary_color),
    season: sanitize(i.season),
    occasion: sanitize(i.occasion),
  }));

  return `You are a fashion advisor AI. The user is considering buying a new item (shown in the image).
Analyze the item in the image and compare it against their existing wardrobe below.

Your job:
1. Identify what category, color, and style the item in the image is.
2. Check if any existing wardrobe items serve a SIMILAR purpose (same category + similar color/style).
3. If similar items exist, suggest an outfit from the existing wardrobe that captures the same VIBE as the new item would.
4. If no similar items exist, explain what wardrobe gap this fills and estimate how many new outfit combinations it would enable.

Return ONLY valid JSON:
{
  "match_found": true/false,
  "item_analysis": "Brief description of the item in the image",
  "similar_item_ids": ["id1", "id2"],
  "suggested_outfit": { "name": "outfit name", "item_ids": ["id1","id2","id3"], "reason": "why this outfit captures the same vibe" } OR null,
  "gap_analysis": "what gap this fills" OR null,
  "outfit_unlock_count": number OR null
}

IMPORTANT: Only use item IDs from the wardrobe list below. Do NOT invent IDs.

User's wardrobe:
${JSON.stringify(safeItems)}`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  }

  try {
    const { imageBase64, items } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }
    if (imageBase64.length > 10_000_000) {
      return NextResponse.json({ error: 'Image too large (max ~7MB)' }, { status: 413 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No wardrobe items provided' }, { status: 400 });
    }

    const prompt = buildPrompt(items);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    // Extract mime type and base64 data
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }
    );
    clearTimeout(timeout);

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid data, please try again' }, { status: 502 });
    }

    // Validate item IDs
    const validIds = new Set(items.map((i: CompactItem) => i.id));
    if (result.similar_item_ids) {
      result.similar_item_ids = result.similar_item_ids.filter((id: string) => validIds.has(id));
    }
    if (result.suggested_outfit?.item_ids) {
      result.suggested_outfit.item_ids = result.suggested_outfit.item_ids.filter((id: string) => validIds.has(id));
      if (result.suggested_outfit.item_ids.length < 2) {
        result.suggested_outfit = null;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Shop check error:', error);
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 });
  }
}
