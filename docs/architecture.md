# Architecture

## Tech Stack

- **Next.js 14** (App Router) — React framework with file-based routing
- **TypeScript** — Type safety across the codebase
- **Tailwind CSS** — Utility-first styling with a custom `clossie` purple palette (50–900)
- **Supabase** — Postgres database, auth, and image storage
- **Vercel** — Deployment platform

## File Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── (auth)/             # Auth group (login, signup) — no bottom nav
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/ai/             # Server-side API routes
│   │   ├── categorize/route.ts
│   │   └── remove-bg/route.ts
│   ├── add/page.tsx        # Photo capture + AI tagging
│   ├── calendar/page.tsx   # Wear history calendar
│   ├── closet/
│   │   ├── page.tsx        # Main closet grid with search & filters
│   │   └── [id]/page.tsx   # Item detail view
│   ├── outfits/
│   │   ├── page.tsx        # Outfit list
│   │   └── builder/page.tsx # Multi-select outfit creator
│   ├── settings/page.tsx
│   ├── stats/page.tsx      # Closet insights & analytics
│   ├── layout.tsx          # Root layout (auth provider, toast, nav)
│   ├── page.tsx            # Home — redirects to /closet or /login
│   └── globals.css
├── components/
│   ├── closet/
│   │   └── ClothingGrid.tsx  # Reusable 3-column item grid
│   └── ui/
│       ├── BottomNav.tsx     # Fixed 5-tab navigation
│       └── SessionGuard.tsx  # Session expiration handler
├── hooks/
│   ├── useClothingItems.ts   # CRUD for clothing items
│   └── useOutfits.ts         # CRUD for outfits + wear logging
└── lib/
    ├── auth-context.tsx      # Auth provider (signUp, signIn, signOut)
    ├── background-removal.ts # Client-side bg removal wrapper
    ├── supabase.ts           # Supabase browser client (singleton)
    ├── toast-context.tsx     # Toast notification system
    └── types.ts              # All TypeScript types & constants
```

## Data Flow

1. **Auth** — `AuthProvider` wraps the entire app. Pages check `useAuth()` and redirect to `/login` if unauthenticated. `SessionGuard` watches for expired sessions globally.

2. **Data fetching** — Custom hooks (`useClothingItems`, `useOutfits`) fetch from Supabase on mount and expose CRUD methods. All filtering (search, category, season, occasion) happens client-side via `useMemo`.

3. **AI pipeline** — When adding an item:
   - User takes/uploads a photo
   - Client calls `/api/ai/remove-bg` to strip the background
   - Client calls `/api/ai/categorize` with the image
   - AI returns category, color, season, occasion
   - User can review/edit tags before saving
   - Image uploaded to Supabase Storage, metadata saved to `clothing_items`

4. **State management** — React `useState` + `useContext` only. No external state library. Toast notifications via context.

## Design System

- **Brand color:** `clossie-600` (#c026d3, purple)
- **Color scale:** `clossie-50` (#fdf4ff) through `clossie-900` (#701a75)
- **Corners:** `rounded-xl` (inputs, cards), `rounded-2xl` (grid items), `rounded-full` (pills/badges)
- **Layout:** Mobile-first, `max-w-lg` (448px max), `pb-20` for bottom nav clearance
- **Icons:** Inline SVGs (Heroicons style)
- **Typography:** System fonts, `text-2xl font-bold` for page titles

## Key Patterns

- **Client components** — All pages use `'use client'` since they depend on auth state and interactivity
- **Sticky headers** — Pages use `sticky top-0 z-40` with `bg-white/90 backdrop-blur-lg`
- **Empty states** — `ClothingGrid` accepts configurable empty state props (icon, title, description, action)
- **Optimistic filtering** — All items loaded at once, filtered client-side for instant response
