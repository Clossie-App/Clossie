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
  wear_count: number;
  last_worn_at: string | null;
  is_favorite: boolean;
}

// Sanitize strings to prevent prompt injection
function sanitize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/["\\\n\r]/g, '').slice(0, 100);
}

function buildPrompt(
  items: CompactItem[],
  filters: { occasion?: string; season?: string; mustIncludeItemId?: string; preferUnworn?: boolean }
): string {
  // Use JSON.stringify for safe serialization instead of string interpolation
  const safeItems = items.map((i) => ({
    id: sanitize(i.id),
    category: sanitize(i.category),
    subcategory: sanitize(i.subcategory),
    color: sanitize(i.color),
    season: sanitize(i.season),
    occasion: sanitize(i.occasion),
    wear_count: typeof i.wear_count === 'number' ? i.wear_count : 0,
    last_worn: sanitize(i.last_worn_at),
    is_favorite: Boolean(i.is_favorite),
  }));

  let rules = `You are a fashion stylist AI. Given a user's wardrobe items, suggest 3 complete outfit combinations.

Rules:
- Each outfit MUST use ONLY item IDs from the provided list — do NOT invent new IDs
- Each outfit should have 3-5 items covering complementary categories (e.g., a top + bottom + shoes, or a dress + shoes + accessory)
- Do not repeat the same item across multiple outfits
- Consider color coordination and style consistency
- Every outfit must be a complete, wearable look`;

  if (filters.occasion) {
    rules += `\n- All outfits must be appropriate for "${sanitize(filters.occasion)}" occasions`;
  }
  if (filters.season) {
    rules += `\n- All outfits must be suitable for "${sanitize(filters.season)}" weather`;
  }
  if (filters.preferUnworn !== false) {
    rules += `\n- Prefer items with lower wear_count to help the user explore their full wardrobe`;
    rules += `\n- Avoid items with recent last_worn dates — mix in things not worn recently`;
    rules += `\n- Items marked as is_favorite: true are pieces the user loves — try to include at least one favorite per outfit`;
  }
  if (filters.mustIncludeItemId) {
    rules += `\n- IMPORTANT: At least one outfit MUST include the item with id "${sanitize(filters.mustIncludeItemId)}". Build the other items around it to create a complete look.`;
  }

  rules += `\n\nReturn ONLY a JSON array with exactly 3 objects: [{ "name": "...", "item_ids": ["..."], "reason": "..." }]
- "name" is a short creative outfit name (2-4 words)
- "item_ids" is an array of item IDs from the list
- "reason" is one sentence explaining the style choice`;

  return `${rules}\n\nUser's wardrobe items:\n${JSON.stringify(safeItems)}`;
}

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
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    const { items, occasion, season, mustIncludeItemId, preferUnworn } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
    if (items.length > 500) {
      return NextResponse.json({ error: 'Too many items (max 500)' }, { status: 400 });
    }

    const prompt = buildPrompt(items, { occasion, season, mustIncludeItemId, preferUnworn });

    let content: string | null = null;

    if (geminiKey) {
      content = await callGemini(geminiKey, prompt);
    } else if (openaiKey) {
      content = await callOpenAI(openaiKey, prompt);
    } else {
      return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 });
    }

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let suggestions;
    try {
      suggestions = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid data, please try again' }, { status: 502 });
    }

    // Validate structure
    if (!Array.isArray(suggestions)) suggestions = [];
    const validItemIds = new Set(items.map((i: CompactItem) => i.id));
    suggestions = suggestions
      .filter((s: Record<string, unknown>) =>
        typeof s.name === 'string' &&
        Array.isArray(s.item_ids) &&
        typeof s.reason === 'string'
      )
      .map((s: Record<string, unknown>) => ({
        name: String(s.name).slice(0, 100),
        item_ids: (s.item_ids as string[]).filter(id => validItemIds.has(id)),
        reason: String(s.reason).slice(0, 300),
      }))
      .filter((s: { item_ids: string[] }) => s.item_ids.length >= 2);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('AI outfit suggestion error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    }
  );
  clearTimeout(timeout);

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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
        { role: 'system', content: 'You are a fashion stylist AI that suggests outfit combinations.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    }),
  });
  clearTimeout(timeout);

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}
