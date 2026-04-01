# API Routes

All API routes are server-side Next.js route handlers under `src/app/api/`.

## POST `/api/ai/categorize`

Analyzes a clothing image and returns category metadata.

### Request
```json
{
  "image": "base64-encoded-image-string"
}
```

### Response
```json
{
  "category": "tops",
  "subcategory": "v-neck",
  "color": "navy blue",
  "secondary_color": "white",
  "season": "all-season",
  "occasion": "casual"
}
```

### How it works
1. Tries **Gemini 2.0 Flash** first (requires `GEMINI_API_KEY`)
2. Falls back to **OpenAI GPT-4o-mini** (requires `OPENAI_API_KEY`)
3. Returns error if neither key is available
4. Uses low temperature (0.1) for consistent results
5. Prompt instructs the model to return only valid enum values matching the app's type system

### Valid return values
- **category:** tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other
- **season:** spring, summer, fall, winter, all-season
- **occasion:** casual, work, going-out, formal, athletic, lounge

---

## POST `/api/ai/suggest-outfits`

Generates AI-powered outfit suggestions from the user's closet items.

### Request
```json
{
  "items": [
    {
      "id": "uuid",
      "category": "tops",
      "subcategory": "v-neck",
      "color": "navy blue",
      "secondary_color": null,
      "season": "all-season",
      "occasion": "casual",
      "wear_count": 3,
      "is_favorite": true
    }
  ],
  "occasion": "work",
  "season": "fall",
  "mustIncludeItemId": "uuid-of-specific-item",
  "preferUnworn": true
}
```

All fields except `items` are optional.

### Response
```json
{
  "suggestions": [
    {
      "name": "Office Chic",
      "item_ids": ["uuid-1", "uuid-2", "uuid-3"],
      "reason": "A polished look pairing navy with neutral tones"
    }
  ]
}
```

### How it works
1. Tries **Gemini 2.0 Flash** first (requires `GEMINI_API_KEY`)
2. Falls back to **OpenAI GPT-4o-mini** (requires `OPENAI_API_KEY`)
3. Sends only item metadata (no images) — fast and low cost
4. Temperature 0.3 for creative but consistent results
5. Returns exactly 3 outfit suggestions, each with 3-5 items
6. Client-side validates all returned item IDs against the real closet (hallucination guard)

### Filters
- **occasion** — All outfits must suit this occasion
- **season** — All outfits must suit this season
- **mustIncludeItemId** — At least one outfit must include this specific item ("Style This" feature)
- **preferUnworn** — AI prioritizes items with lower wear counts and includes favorites

---

## POST `/api/ai/remove-bg`

Removes the background from a clothing image.

### Request
```json
{
  "image": "base64-encoded-image-string"
}
```

### Response
```json
{
  "image": "base64-encoded-png-with-transparent-background"
}
```

### How it works
1. Tries **remove.bg** API first (requires `REMOVE_BG_API_KEY`)
2. Falls back to **Hugging Face RMBG-1.4** model (free, no key needed)
3. HuggingFace has a 30-second timeout
4. Returns transparent PNG

### Error handling
- If both services fail, returns the original image unchanged
- Client-side wrapper in `src/lib/background-removal.ts` handles the fallback gracefully
