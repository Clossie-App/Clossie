import { NextRequest, NextResponse } from 'next/server';

interface CompactItem {
  id: string;
  category: string;
  subcategory: string | null;
  color: string;
  secondary_color: string | null;
  season: string;
  occasion: string;
  wear_count: number;
  is_favorite: boolean;
}

function buildPrompt(
  items: CompactItem[],
  filters: { occasion?: string; season?: string; mustIncludeItemId?: string; preferUnworn?: boolean }
): string {
  const itemList = items
    .map(
      (i) =>
        `{ id: "${i.id}", category: "${i.category}", subcategory: "${i.subcategory || ''}", color: "${i.color}", season: "${i.season}", occasion: "${i.occasion}", wear_count: ${i.wear_count}, is_favorite: ${i.is_favorite} }`
    )
    .join('\n');

  let rules = `You are a fashion stylist AI. Given a user's wardrobe items, suggest 3 complete outfit combinations.

Rules:
- Each outfit MUST use ONLY item IDs from the provided list — do NOT invent new IDs
- Each outfit should have 3-5 items covering complementary categories (e.g., a top + bottom + shoes, or a dress + shoes + accessory)
- Do not repeat the same item across multiple outfits
- Consider color coordination and style consistency
- Every outfit must be a complete, wearable look`;

  if (filters.occasion) {
    rules += `\n- All outfits must be appropriate for "${filters.occasion}" occasions`;
  }
  if (filters.season) {
    rules += `\n- All outfits must be suitable for "${filters.season}" weather`;
  }
  if (filters.preferUnworn !== false) {
    rules += `\n- Prefer items with lower wear_count to help the user explore their full wardrobe`;
    rules += `\n- Items marked as is_favorite: true are pieces the user loves — try to include at least one favorite per outfit`;
  }
  if (filters.mustIncludeItemId) {
    rules += `\n- IMPORTANT: At least one outfit MUST include the item with id "${filters.mustIncludeItemId}". Build the other items around it to create a complete look.`;
  }

  rules += `\n\nReturn ONLY a JSON array with exactly 3 objects: [{ "name": "...", "item_ids": ["..."], "reason": "..." }]
- "name" is a short creative outfit name (2-4 words)
- "item_ids" is an array of item IDs from the list
- "reason" is one sentence explaining the style choice`;

  return `${rules}\n\nUser's wardrobe items:\n${itemList}`;
}

export async function POST(request: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    const { items, occasion, season, mustIncludeItemId, preferUnworn } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
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
    const suggestions = JSON.parse(jsonStr);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('AI outfit suggestion error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      }),
    }
  );

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
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

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}
