import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const VALID_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'jewelry', 'activewear', 'other'];

const DETECT_PROMPT = `You are an expert fashion AI. Detect every clothing item, shoe, bag, and accessory in this image.

For EACH item found, return:
- "label": descriptive name with color (e.g., "white crop top", "black leather boots")
- "category": one of: tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other
- "box_2d": bounding box as [y_min, x_min, y_max, x_max] normalized to 0-1000 scale

CRITICAL detection rules:
- Detect items even when WORN on a person in lifestyle/full-body photos
- Detect each layer separately (jacket AND visible shirt underneath)
- Detect partially hidden items (shoes partially cut off, etc.)
- Detect small items: jewelry, watches, belts, sunglasses, hats
- Be THOROUGH — better to detect too many items than miss one
- Make bounding boxes tight around each individual item
- If only one item visible, return a one-element array
- If nothing clothing-related found, return an empty array []`;

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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ items: [] }, { status: 500 });

  try {
    const { imageBase64, mimeType } = await request.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') return NextResponse.json({ items: [] }, { status: 400 });
    if (imageBase64.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

    // Try Gemini 2.5 Flash first (better detection), fall back to 2.0
    let items = await detectWithGemini25(geminiKey, imageBase64, mimeType || 'image/jpeg');
    if (items === null) {
      items = await detectWithGemini20(geminiKey, imageBase64, mimeType || 'image/jpeg');
    }

    return NextResponse.json({ items: items || [] });
  } catch (error) {
    console.error('Detection error:', error);
    return NextResponse.json({ items: [], error: 'Detection failed' }, { status: 500 });
  }
}

interface RawItem {
  label?: string;
  category?: string;
  box_2d?: number[];
  box?: number[];
}

function validateAndNormalize(rawItems: RawItem[]): Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }> {
  return rawItems
    .filter((item) => {
      const box = item.box_2d || item.box;
      return box && Array.isArray(box) && box.length === 4;
    })
    .map((item, index) => {
      const cat = String(item.category || 'other');
      const box = (item.box_2d || item.box)!;
      return {
        id: `detected-${index}`,
        label: String(item.label || 'Clothing item').slice(0, 100),
        category: VALID_CATEGORIES.includes(cat) ? cat : 'other',
        box: box.map((v: number) => Math.max(0, Math.min(1000, Math.round(v)))),
        selected: true,
      };
    })
    .filter((item) => {
      const [y1, x1, y2, x2] = item.box;
      return (x2 - x1) > 20 && (y2 - y1) > 20;
    });
}

async function detectWithGemini25(
  apiKey: string,
  imageBase64: string,
  mimeType: string
): Promise<Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: DETECT_PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const rawItems: RawItem[] = Array.isArray(parsed) ? parsed : [];
    return validateAndNormalize(rawItems);
  } catch (e) {
    console.error('Gemini 2.5 detection failed, falling back:', e);
    return null;
  }
}

async function detectWithGemini20(
  apiKey: string,
  imageBase64: string,
  mimeType: string
): Promise<Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: DETECT_PROMPT + '\n\nReturn ONLY a JSON array, no markdown.' },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    }
  );
  clearTimeout(timeout);

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : '[]';

  let rawItems: RawItem[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    rawItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    rawItems = [];
  }

  return validateAndNormalize(rawItems);
}
