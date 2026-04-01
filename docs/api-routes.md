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
