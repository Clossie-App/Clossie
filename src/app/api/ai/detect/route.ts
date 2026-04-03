import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const VALID_CATEGORIES = ['tops','bottoms','dresses','outerwear','shoes','bags','accessories','jewelry','activewear','other'];

const DETECT_PROMPT = `You are an expert fashion AI specializing in detecting clothing items in photos. Your task is to find EVERY distinct clothing item, shoe, bag, and accessory that a person is wearing or that is visible in the image.

CRITICAL: You must detect items even when they are:
- Being WORN by a person in a full-body or lifestyle photo
- Partially hidden or overlapping with other clothing
- In complex backgrounds (outdoors, crowded scenes, events)
- Small in the frame (like jewelry, watches, belts)
- Layered (detect EACH layer separately — e.g., a jacket AND the shirt underneath if visible)

For each item found, return a tight bounding box with coordinates normalized to a 0-1000 scale:
- 0 = top/left edge of the image
- 1000 = bottom/right edge of the image
- Format: [y_min, x_min, y_max, x_max]

Return ONLY a JSON array in this exact format:
[{"label":"blue denim jeans","category":"bottoms","box":[ymin,xmin,ymax,xmax]},...]

Valid categories: tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other

Detection rules:
- Be THOROUGH — it is better to detect too many items than to miss one
- Each item gets its own entry even if they overlap
- "tops" includes t-shirts, blouses, tank tops, crop tops, sweaters, hoodies
- "bottoms" includes jeans, pants, shorts, skirts, leggings
- "dresses" includes any one-piece dress, jumpsuit, romper
- "outerwear" includes jackets, coats, blazers, vests worn as outer layer
- "shoes" includes any footwear — sneakers, boots, heels, sandals, even if partially visible
- "bags" includes purses, handbags, backpacks, clutches, tote bags
- "accessories" includes hats, scarves, belts, sunglasses, watches
- "jewelry" includes necklaces, earrings, bracelets, rings
- Labels should be descriptive: include color + item type (e.g., "white crop top", "black leather boots")
- Make bounding boxes as tight as possible around each individual item
- If only ONE item is visible, return a one-element array
- If nothing clothing-related is found, return []
- Return ONLY the JSON array, no markdown, no explanation`;

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
    const { imageBase64 } = await request.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') return NextResponse.json({ items: [] }, { status: 400 });
    if (imageBase64.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s for complex images

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: DETECT_PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ]}],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1500, // More tokens for complex multi-item photos
          },
        }),
      }
    );
    clearTimeout(timeout);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '[]';

    let items = JSON.parse(jsonStr);
    if (!Array.isArray(items)) items = [];

    // Validate, normalize, and filter bad boxes
    items = items
      .filter((item: Record<string, unknown>) =>
        item.box && Array.isArray(item.box) && (item.box as unknown[]).length === 4
      )
      .map((item: Record<string, unknown>, index: number) => {
        const cat = String(item.category || 'other');
        const box = (item.box as number[]).map((v: number) => Math.max(0, Math.min(1000, Math.round(v))));
        return {
          id: `detected-${index}`,
          label: String(item.label || 'Clothing item').slice(0, 100),
          category: VALID_CATEGORIES.includes(cat) ? cat : 'other',
          box,
          selected: true,
        };
      })
      // Filter out impossibly small boxes (less than 3% of image in either dimension)
      .filter((item: { box: number[] }) => {
        const [y1, x1, y2, x2] = item.box;
        return (x2 - x1) > 30 && (y2 - y1) > 30;
      });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Detection error:', error);
    return NextResponse.json({ items: [], error: 'Detection failed' }, { status: 500 });
  }
}
