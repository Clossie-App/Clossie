# Clossie - My Closet

A smart closet organizer PWA that uses AI to automatically categorize your clothing. Take a photo, and Clossie handles the rest — removing the background, tagging the category, color, season, and occasion.

## Features

- **AI-Powered Tagging** — Snap a photo and Gemini/GPT auto-categorizes your item (category, color, season, occasion)
- **Background Removal** — Clean product-style images via remove.bg or Hugging Face
- **Closet Browser** — Filter by category, season, occasion. Search by color, brand, or type
- **Outfit Builder** — Combine items into outfits, assign occasions, log when you wear them
- **Wear Calendar** — Monthly view of what you wore and when
- **Closet Insights** — Stats on most/least worn items, cost-per-wear, neglected pieces, total closet value
- **Wishlist** — Save items you want alongside what you own
- **Share Target** — Share images directly from your phone's gallery into Clossie
- **Installable PWA** — Add to home screen for a native app feel

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS with custom `clossie` color palette |
| Auth & DB | Supabase (email/password auth, Postgres, Storage) |
| AI | Google Gemini 2.0 Flash, OpenAI GPT-4o-mini |
| Background Removal | remove.bg API, Hugging Face RMBG-1.4 |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables (see docs/setup.md)
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/              # Next.js App Router pages
    (auth)/         # Login & signup
    api/ai/         # AI categorization & background removal endpoints
    add/            # Photo capture & AI tagging
    closet/         # Closet grid & item detail
    outfits/        # Outfit list & builder
    calendar/       # Wear history calendar
    stats/          # Closet insights & analytics
    settings/       # User settings
  components/       # Reusable UI components
  hooks/            # Data fetching hooks (useClothingItems, useOutfits)
  lib/              # Auth context, Supabase client, types, utilities
public/
  icons/            # PWA icons
  manifest.json     # PWA manifest with share target
docs/               # Project documentation
```

## Documentation

See the [`docs/`](./docs) folder for detailed documentation:

- [Setup Guide](./docs/setup.md) — Environment variables, Supabase config, local dev
- [Architecture](./docs/architecture.md) — File structure, data flow, design decisions
- [Features](./docs/features.md) — Detailed feature documentation
- [API Routes](./docs/api-routes.md) — AI endpoints and integrations
- [Database Schema](./docs/database.md) — Supabase tables and relationships

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## License

Private project.
