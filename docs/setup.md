# Setup Guide

## Prerequisites

- Node.js 18+
- npm
- A Supabase project ([supabase.com](https://supabase.com))

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Required — Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional — AI Categorization (at least one recommended)
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Optional — Background Removal
REMOVE_BG_API_KEY=your-removebg-key
```

### How AI fallbacks work

- **Categorization:** Tries Gemini 2.0 Flash first (cheapest/fastest), falls back to OpenAI GPT-4o-mini
- **Background removal:** Tries remove.bg first, falls back to free Hugging Face RMBG-1.4 model

If no API keys are set, items can still be added with manual tagging.

## Supabase Setup

### Database Tables

The app expects these tables in your Supabase project. See [database.md](./database.md) for full schema.

- `clothing_items` — Closet inventory
- `outfits` — Saved outfit combinations
- `outfit_items` — Links outfits to clothing items
- `wear_log` — Outfit wear history

### Storage

Create a public storage bucket called `clothing-images` for item photos.

### Auth

Email/password auth is used. Enable it in Supabase Dashboard > Authentication > Providers.

## Local Development

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run build
npm run start
```

## PWA Installation

The app is installable as a PWA. On mobile, visit the site in Chrome/Safari and use "Add to Home Screen." The share target feature lets you share images directly from your gallery into Clossie.
