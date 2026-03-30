# Narnia — Ledger of Successes & Failures

> **APPEND ONLY.** Never edit, delete, or reword existing entries. New entries are added to the bottom of their section with the next sequential number (F8, S9, etc.). This is a permanent, immutable record.

> This file tracks what worked and what didn't during development.
> Always read this before starting new work so you follow winning patterns and avoid past mistakes.

---

## FAILURES (Never Do These Again)

### F1: @imgly/background-removal package breaks Next.js build
- **What happened:** Installed `@imgly/background-removal` for client-side background removal. It depends on `onnxruntime-web` which has massive WebAssembly modules that webpack can't handle in Next.js.
- **Error:** `Module not found: Can't resolve 'onnxruntime-web/webgpu'`
- **Fix:** Removed the package entirely. Switched to a server-side API route that calls Hugging Face's free BRIA RMBG model instead.
- **Lesson:** Never use heavy WASM/ONNX packages in a Next.js client bundle. Use server-side API routes to call AI models.

### F2: @types/react version mismatch breaks Vercel deploy
- **What happened:** `@types/react@19.x` conflicted with `@types/react-dom@18.x`. npm refused to install on Vercel (no `--legacy-peer-deps` flag).
- **Error:** `ERESOLVE could not resolve dependency`
- **Fix:** Downgraded `@types/react` to `^18.3.0` to match `@types/react-dom@^18.3.0`.
- **Lesson:** Always keep `@types/react` and `@types/react-dom` on the same major version. Check `package.json` before pushing.

### F3: useSearchParams without Suspense boundary crashes Vercel build
- **What happened:** The outfit builder page used `useSearchParams()` at the top level. Next.js 14 requires it to be inside a `<Suspense>` boundary for static generation.
- **Error:** `useSearchParams() should be wrapped in a suspense boundary at page "/outfits/builder"`
- **Fix:** Split the page into a wrapper component with `<Suspense>` and the actual content component.
- **Lesson:** Any page using `useSearchParams()` needs a Suspense wrapper. Always use this pattern:
```tsx
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PageContent />
    </Suspense>
  );
}
function PageContent() {
  const searchParams = useSearchParams();
  // ...
}
```

### F4: Buffer type not assignable to BodyInit in API routes
- **What happened:** Node.js `Buffer` objects can't be passed directly as `NextResponse` body or `fetch` body in newer TypeScript versions.
- **Error:** `Type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit'`
- **Fix:** Used `ArrayBuffer` with `as any` cast for NextResponse bodies, or convert to `Uint8Array`.
- **Lesson:** In Next.js API routes, use `ArrayBuffer` instead of `Buffer` for response bodies. Cast with `as any` if TypeScript complains.

### F5: npx create-next-app interactive prompts hang in automation
- **What happened:** Tried to use `npx create-next-app` but it asks interactive questions that can't be answered in automated scripts.
- **Fix:** Manually created the project with `npm init -y` and installed dependencies individually.
- **Lesson:** For automated project creation, skip `create-next-app` and set up manually: `npm init`, install deps, create config files by hand.

### F6: Set iteration fails with ES5 target
- **What happened:** `[...new Set(array)]` pattern failed because tsconfig targeted ES5.
- **Error:** `Type 'Set<any>' can only be iterated through when using '--downlevelIteration' flag`
- **Fix:** Changed `tsconfig.json` target from `es5` to `es2017`.
- **Lesson:** Always use `"target": "es2017"` or higher in tsconfig for modern JavaScript features.

### F7: Git SSH permission denied when pushing to different GitHub account
- **What happened:** Computer's SSH key was set up under `DylanGIV` but the repo was created under `Alishacan`.
- **Error:** `Permission to Alishacan/narnia.git denied to DylanGIV`
- **Fix:** Used HTTPS with GitHub token instead of SSH: `git remote set-url origin "https://$(gh auth token)@github.com/Alishacan/narnia.git"`
- **Lesson:** When multiple GitHub accounts are on the same machine, use HTTPS with token auth, not SSH.

---

## SUCCESSES (Follow These Patterns)

### S1: Server-side API routes for AI processing
- **What:** All AI calls (Gemini categorization, background removal) go through Next.js API routes (`/api/ai/categorize`, `/api/ai/remove-bg`).
- **Why it works:** API keys stay on the server (never exposed to the browser). Heavy processing happens server-side. Client just sends an image and gets back results.
- **Pattern:** `Client → /api/ai/[task]/route.ts → External AI API → Response back to client`

### S2: Multi-provider fallback chain for AI services
- **What:** The categorization route tries Gemini first, then falls back to OpenAI. Background removal tries remove.bg, then Hugging Face, then returns the original image.
- **Why it works:** No single point of failure. If one service is down or over quota, the next one picks up. User never sees an error.
- **Pattern:** Try best option → catch failure → try next option → fallback to safe default

### S3: Supabase Row Level Security from day one
- **What:** Every table has RLS policies so users can only see/edit their own data.
- **Why it works:** Security is built in at the database level. Even if the app code has a bug, one user can never see another user's closet.
- **Pattern:** Always add RLS policies when creating tables. Use `auth.uid() = user_id` pattern.

### S4: PWA manifest with share_target
- **What:** Added `share_target` to the PWA manifest so Narnia appears in the iPhone share menu.
- **Why it works:** Users can share images from any app directly into Narnia. Reduces friction massively.
- **Pattern:** Add `share_target` with `method: POST` and `enctype: multipart/form-data` in `manifest.json`.

### S5: Streamlined add-item flow (auto-process, one-tap save)
- **What:** When user selects an image, processing starts immediately (background removal → AI categorization). Results shown with one big Save button. Details are hidden behind an expandable section.
- **Why it works:** Minimum taps. Power users can expand details if they want, but casual users just tap Save.
- **Pattern:** Default to the simplest flow. Hide advanced options behind "Edit details" or expandable sections.

### S6: Free-tier-first architecture
- **What:** Every service is chosen for its free tier: Supabase (database + auth + storage), Vercel (hosting), Gemini (AI), Hugging Face (background removal).
- **Why it works:** Total cost is near $0 for personal use. No subscriptions, no surprise bills.
- **Pattern:** Always check free tier limits before choosing a service. Prefer services with generous free tiers.

### S7: Environment variables for all API keys
- **What:** All secrets go in `.env.local` (not in code). `.gitignore` excludes it. Vercel has its own env var settings.
- **Why it works:** Keys never end up on GitHub. Different environments (local vs production) can have different keys.
- **Pattern:** Never hardcode API keys. Always use `process.env.KEY_NAME` and add to `.env.local` + Vercel dashboard.

### S8: Tailwind utility classes + consistent design tokens
- **What:** Custom `narnia` color palette in Tailwind config. All components use the same rounded corners (`rounded-xl`, `rounded-2xl`), spacing, and shadow patterns.
- **Why it works:** Consistent look across all pages without a heavy component library. Easy to change the whole theme by updating the color palette.
- **Pattern:** Define brand colors in `tailwind.config.ts`. Stick to a consistent set of border-radius and shadow values app-wide.

---

## TECH STACK DECISIONS

| Choice | Why | Alternatives Considered |
|--------|-----|------------------------|
| Next.js 14 (not 15) | Stable, well-documented, Vercel-optimized | Next.js 15 (too new, breaking changes) |
| Supabase (not Firebase) | PostgreSQL, free tier, RLS built in, simpler auth | Firebase (NoSQL, more complex pricing) |
| Tailwind (not MUI) | Lighter, faster, mobile-first, no component lock-in | MUI (heavier, more opinionated) |
| Gemini Flash (not GPT-4o) | Cheapest per image, free tier 1500/day | OpenAI (more expensive, no free tier) |
| Hugging Face BRIA (not remove.bg) | Free, no API key needed | remove.bg (50 free/month then paid) |
| Vercel (not Netlify) | Best Next.js support, free tier | Netlify (good but less Next.js optimized) |

---

## DATABASE MIGRATIONS LOG

| Date | Migration | File |
|------|-----------|------|
| 2026-03-30 | Initial schema: all tables, RLS, storage bucket | `supabase-setup.sql` |
| 2026-03-30 | Add `is_wishlist` column to `clothing_items` | `supabase-add-wishlist.sql` |
