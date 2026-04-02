import { NextRequest, NextResponse } from 'next/server';

const DETECT_PROMPT = `You are a clothing detection AI. Analyze this image and find every distinct clothing item or accessory visible.

For each item, return its bounding box with coordinates normalized to a 0-1000 scale (0 = top/left edge, 1000 = bottom/right edge).

Return ONLY a JSON array in this exact format:
[{"label":"blue jeans","category":"bottoms","box":[ymin,xmin,ymax,xmax]},...]

Valid categories: tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other

Rules:
- Only include clothing and accessory items — not people, skin, backgrounds, or furniture
- Make bounding boxes as tight as possible around each item
- Single item in photo = return a one-element array
- Nothing found = return []
- Return ONLY the JSON array, no markdown, no explanation`;

export async function POST(request: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ items: [] }, { status: 500 });

  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) return NextResponse.json({ items: [] }, { status: 400 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        }),
      }
    );
    clearTimeout(timeout);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    // Extract JSON array — handles both bare JSON and markdown code blocks without corrupting content
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '[]';

    let items = JSON.parse(jsonStr);
    if (!Array.isArray(items)) items = [];

    // Validate and normalize
    items = items
      .filter((item: Record<string, unknown>) =>
        item.box && Array.isArray(item.box) && (item.box as unknown[]).length === 4
      )
      .map((item: Record<string, unknown>, index: number) => ({
        id: `detected-${index}`,
        label: (item.label as string) || 'Clothing item',
        category: (item.category as string) || 'other',
        box: (item.box as number[]).map((v: number) => Math.max(0, Math.min(1000, Math.round(v)))),
        selected: true,
      }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Detection error:', error);
    return NextResponse.json({ items: [] });
  }
}
