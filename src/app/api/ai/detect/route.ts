import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const VALID_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'jewelry', 'activewear', 'other'];

const DETECT_PROMPT = `You are an expert fashion AI that detects clothing items in photos.

STEP 1: Look at the image carefully. List every clothing item, shoe, bag, and accessory you can see.
STEP 2: For each item, estimate where it is in the image using a bounding box.

Return a JSON object with an "items" array. Each item has:
- "label": descriptive name with color (e.g., "white crop top", "black leather boots")
- "category": one of: tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other
- "confidence": "high", "medium", or "low"
- "box_2d": bounding box as [y_min, x_min, y_max, x_max] where each value is a fraction from 0.0 to 1.0

BOUNDING BOX GUIDE — use these examples as spatial references:
- A shirt/top on someone's upper body: approximately [0.10, 0.15, 0.50, 0.85]
- Pants/bottoms on the lower body: approximately [0.45, 0.20, 0.85, 0.80]
- A full-body dress: approximately [0.10, 0.15, 0.85, 0.85]
- Shoes at the bottom of a full-body photo: approximately [0.82, 0.20, 1.0, 0.80]
- A hat at the top of the frame: approximately [0.0, 0.25, 0.12, 0.75]
- A bag held at the side: approximately [0.35, 0.0, 0.70, 0.30] or [0.35, 0.70, 0.70, 1.0]
- A flat-lay item centered in frame: approximately [0.05, 0.05, 0.95, 0.95]

RULES:
- Detect items WORN on a person — clothing on a body still counts
- Detect each layer separately (jacket AND shirt underneath)
- Detect small items: jewelry, watches, belts, sunglasses, hats
- Each item MUST have its own unique bounding box — no sharing boxes
- When unsure about exact coordinates, make the box SLIGHTLY LARGER rather than too small
- If nothing clothing-related found, return {"items": []}

Return ONLY the JSON object.`;

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
    const { imageBase64 } = await request.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') return NextResponse.json({ items: [] }, { status: 400 });
    if (imageBase64.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

    // Try YOLO first (fast, accurate bounding boxes), fall back to Ollama
    let items = await detectWithYolo(imageBase64);
    if (items.length === 0) {
      console.log('[Detect] YOLO returned no items, trying Ollama fallback');
      items = await detectWithOllama(imageBase64);
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Detection error:', error);
    return NextResponse.json({ items: [], error: 'Detection failed' }, { status: 500 });
  }
}

/**
 * Detect clothing items using the local YOLO server (scripts/yolo-server.py).
 * Fashion-trained YOLOv8 model gives pixel-accurate bounding boxes in ~3 seconds.
 * Returns empty array if server is down so the caller can fall back to Ollama.
 */
interface YoloItem {
  label: string;
  category: string;
  box_2d: [number, number, number, number];
  confidence: number;
}

async function detectWithYolo(
  imageBase64: string
): Promise<Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s — YOLO is fast

    const response = await fetch('http://localhost:5002/detect', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, conf: 0.3 }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log('[Detect] YOLO server returned', response.status);
      return [];
    }

    const data = await response.json();
    const yoloItems: YoloItem[] = Array.isArray(data.items) ? data.items : [];
    console.log(`[Detect] YOLO found ${yoloItems.length} items in ${data.time_seconds}s`);

    // YOLO already returns 0-1000 scale boxes. Just normalize to our interface.
    return yoloItems
      .filter((item) => {
        const [y1, x1, y2, x2] = item.box_2d;
        return (x2 - x1) > 20 && (y2 - y1) > 20; // skip tiny boxes
      })
      .map((item, index) => ({
        id: `yolo-${index}`,
        label: String(item.label || 'Clothing item').slice(0, 100),
        category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
        box: item.box_2d,
        selected: true,
      }));
  } catch (err) {
    // Silent fallback — YOLO server not running is fine, Ollama takes over
    if ((err as Error).name === 'AbortError') {
      console.log('[Detect] YOLO server timed out');
    } else {
      console.log('[Detect] YOLO server unavailable:', (err as Error).message);
    }
    return [];
  }
}

interface RawItem {
  label?: string;
  category?: string;
  confidence?: string;
  box_2d?: number[];
  box?: number[];
}

const BOX_PADDING = 0.08; // 8% padding on each side to compensate for approximate LLM boxes

function validateAndNormalize(rawItems: RawItem[]): Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }> {
  return rawItems
    .filter((item) => {
      const box = item.box_2d || item.box;
      if (!box || !Array.isArray(box) || box.length !== 4) return false;
      // Filter out low-confidence detections
      if (item.confidence === 'low') return false;
      return true;
    })
    .map((item, index) => {
      const cat = String(item.category || 'other');
      const rawBox = (item.box_2d || item.box)!;
      // Auto-detect scale: if all values <= 1, it's 0-1 scale (Ollama); multiply by 1000
      // If values are in 0-1000 range already (Gemini), keep as is
      const maxVal = Math.max(...rawBox.map(Math.abs));
      const scale = maxVal <= 1.0 ? 1000 : 1;
      const [y1, x1, y2, x2] = rawBox.map((v: number) => Math.round(v * scale));

      // Add padding to compensate for approximate bounding boxes
      const boxW = x2 - x1;
      const boxH = y2 - y1;
      const padX = Math.round(boxW * BOX_PADDING);
      const padY = Math.round(boxH * BOX_PADDING);
      const box = [
        Math.max(0, y1 - padY),
        Math.max(0, x1 - padX),
        Math.min(1000, y2 + padY),
        Math.min(1000, x2 + padX),
      ];

      return {
        id: `detected-${index}`,
        label: String(item.label || 'Clothing item').slice(0, 100),
        category: VALID_CATEGORIES.includes(cat) ? cat : 'other',
        box,
        selected: true,
      };
    })
    .filter((item) => {
      const [y1, x1, y2, x2] = item.box;
      return (x2 - x1) > 20 && (y2 - y1) > 20;
    });
}

/**
 * Detect clothing items using Llama 3.2 Vision 11B via Ollama (local, free).
 */
async function detectWithOllama(
  imageBase64: string
): Promise<Array<{ id: string; label: string; category: string; box: number[]; selected: boolean }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s for detection (heavier task)

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2-vision:11b',
        prompt: DETECT_PROMPT,
        images: [imageBase64],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 2000,
        },
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[Detect] Ollama HTTP error:', response.status);
      return [];
    }

    const data = await response.json();
    const text = data.response;
    if (!text) {
      console.error('[Detect] Ollama returned no response');
      return [];
    }

    console.log('[Detect] Ollama raw:', text.substring(0, 500));

    // Parse the response — Ollama with format:'json' returns a JSON object
    // but we asked for an array, so it might wrap it in an object
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON array from text
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          parsed = JSON.parse(arrMatch[0]);
        } catch {
          console.error('[Detect] Failed to parse Ollama JSON');
          return [];
        }
      } else {
        return [];
      }
    }

    // Handle array, object-wrapped-array, or single-item object responses
    let rawItems: RawItem[];
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      // Check if it's a wrapped array: { "items": [...] }
      const arrKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
      if (arrKey) {
        rawItems = obj[arrKey] as RawItem[];
      } else if (obj.label || obj.category || obj.box_2d) {
        // Single item returned as object — wrap in array
        rawItems = [obj as RawItem];
      } else {
        rawItems = [];
      }
    } else {
      rawItems = [];
    }

    const items = validateAndNormalize(rawItems);
    console.log(`[Detect] Found ${items.length} items via Ollama`);
    return items;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[Detect] Ollama timed out after 90s');
    } else {
      console.error('[Detect] Ollama not available:', (err as Error).message);
    }
    return [];
  }
}

