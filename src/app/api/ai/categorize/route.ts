import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const VALID_CATEGORIES = ['tops','bottoms','dresses','outerwear','shoes','bags','accessories','jewelry','activewear','other'];
const VALID_SEASONS = ['spring','summer','fall','winter','all-season'];
const VALID_OCCASIONS = ['casual','work','going-out','formal','athletic','lounge'];

const PROMPT = `You are an expert fashion categorization AI. Analyze the clothing item in the image carefully.

The image may be a cropped section from a larger photo, so the item may be partially visible or on a person's body. Focus on identifying WHAT the item IS, not the background or the person.

Return a JSON object with these fields:
- category: one of "tops", "bottoms", "dresses", "outerwear", "shoes", "bags", "accessories", "jewelry", "activewear", "other"
- subcategory: be SPECIFIC — e.g., "crop top", "high-waisted jeans", "platform sneakers", "crossbody bag", "stud earrings", "midi skirt", "bomber jacket"
- color: the ACTUAL color of the clothing item as a CSS color name (e.g., "black", "navy", "coral", "olive", "cream"). Use hex only if the color is unusual.
- secondary_color: secondary color if the item has a pattern, print, or is two-toned. Otherwise null.
- season: one of "spring", "summer", "fall", "winter", "all-season" — based on fabric weight, coverage, and typical usage
- occasion: one of "casual", "work", "going-out", "formal", "athletic", "lounge" — based on style, material, and formality

IMPORTANT: Never return "other" as category unless the item truly cannot be classified. A tank top is "tops", cowboy boots are "shoes", a belt is "accessories", etc.

Return ONLY the JSON object, no other text.`;

export async function POST(request: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

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
    const { imageBase64 } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }
    if (imageBase64.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    let content: string | null = null;

    // Try Gemini first (cheapest), fall back to OpenAI
    if (geminiKey) {
      content = await callGemini(geminiKey, imageBase64);
    } else if (openaiKey) {
      content = await callOpenAI(openaiKey, imageBase64);
    } else {
      return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 });
    }

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON from the response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const raw = JSON.parse(jsonStr);

    // Validate AI output — clamp to known values
    const categorization = {
      category: VALID_CATEGORIES.includes(raw.category) ? raw.category : 'other',
      subcategory: typeof raw.subcategory === 'string' ? raw.subcategory.slice(0, 100) : null,
      color: typeof raw.color === 'string' ? raw.color.slice(0, 30) : '#808080',
      secondary_color: typeof raw.secondary_color === 'string' ? raw.secondary_color.slice(0, 30) : null,
      season: VALID_SEASONS.includes(raw.season) ? raw.season : 'all-season',
      occasion: VALID_OCCASIONS.includes(raw.occasion) ? raw.occasion : 'casual',
    };

    return NextResponse.json(categorization);
  } catch (error) {
    console.error('AI categorization error:', error);
    return NextResponse.json({ error: 'Failed to categorize item' }, { status: 500 });
  }
}

async function callGemini(apiKey: string, imageBase64: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT + '\n\nCategorize this clothing item.' },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
    }
  );
  clearTimeout(timeout);

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callOpenAI(apiKey: string, imageBase64: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'low' },
            },
            { type: 'text', text: 'Categorize this clothing item.' },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    }),
  });
  clearTimeout(timeout);

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}
