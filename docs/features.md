# Features

## Closet Management

### Adding Items
- **Photo capture** — Use camera or upload from gallery
- **Background removal** — Automatically removes background for clean product-style photos
- **AI categorization** — Gemini/GPT analyzes the image and suggests category, subcategory, color, season, and occasion
- **Manual editing** — Review and adjust all AI-suggested tags before saving
- **Share target** — Share images from other apps directly into Clossie (PWA feature)

### Browsing & Filtering
- **Category tabs** — Horizontal scrollable pills: All, Tops, Bottoms, Dresses, Outerwear, Shoes, Bags, Accessories, Jewelry, Activewear
- **Search bar** — Instant search by color, brand, subcategory, notes, or category name
- **Season filter** — Spring, Summer, Fall, Winter, All-Season
- **Occasion filter** — Casual, Work, Going Out, Formal, Athletic, Lounge
- **Sort options** — Newest, Most Worn, Least Worn
- **View modes** — My Closet (owned), Wishlist, All

### Item Detail
- **Full image view** with metadata (category, color, brand, size, season, occasion, notes)
- **Toggle favorite** — Heart icon
- **Toggle laundry** — Mark items as currently in the wash
- **Wear count** — How many times the item has been worn
- **Delete** — With confirmation dialog
- **Build outfit** — Quick action to jump to outfit builder with this item

## Outfit Management

### Outfit Builder
- **Multi-select** — Pick items from your closet by category tabs
- **Name & tag** — Give the outfit a name, occasion, and season
- **Preview** — See selected items as a collection before saving

### Outfit List
- **Thumbnail grid** — Each outfit shows its component items
- **Log wear** — Record when you wear an outfit (increments wear count on all items)
- **Delete** — Remove outfits with confirmation

## Wear Calendar
- **Monthly view** — Calendar grid showing which days you wore outfits
- **Day detail** — Tap a highlighted day to see what outfit was worn
- **Month navigation** — Browse forward and backward through months

## Closet Insights (Stats)
- **Overview cards** — Total items, total outfits, total wears
- **Category breakdown** — Visual chart of items per category
- **Most worn items** — Your go-to pieces
- **Least worn items** — Pieces that need more love
- **Cost-per-wear** — Price divided by wear count (for items with price data)
- **Neglected items** — Items not worn in 3+ months
- **Total closet value** — Sum of all item prices

## AI Outfit Suggestions
- **Generate ideas** — Tap "AI Suggest" and get 3 complete outfit combinations built from your actual closet items
- **Powered by Gemini/GPT** — Only sends item metadata (category, color, season) — no images, so it's fast and cheap
- **Filters** — Narrow by occasion and season before generating
- **Prioritize unworn** — Toggle to have the AI favor items you haven't worn much
- **Laundry excluded** — Items currently in the wash are automatically left out
- **Hallucination guard** — AI-returned item IDs are validated against your real closet; invalid suggestions are filtered out
- **One-tap save** — Save any suggestion as a real outfit with a single tap
- **"Style This" entry point** — From any item detail page, get outfits built around that specific piece
- **Loading UX** — Rotating status messages and skeleton cards while AI thinks

## Onboarding
- **4-step welcome flow** — New users see a swipeable carousel introducing Clossie's key features before entering the app
- **Step 1: Welcome** — Personalized greeting using your first name
- **Step 2: AI Magic** — Explains the AI-powered categorization (snap a photo, get instant tags)
- **Step 3: Outfit Ideas** — Introduces the AI outfit suggestion feature
- **Step 4: Let's Go** — Final call-to-action to start building your closet
- **Swipe gestures** — Swipe left/right to navigate between steps on mobile
- **Dot indicators** — Visual progress dots showing which step you're on
- **Skip button** — Skip the entire flow at any time
- **One-time only** — Completion is tracked via Supabase `user_metadata` (`onboarded_at` timestamp); returning users go straight to their closet
- **No database migration** — Uses Supabase auth metadata (JSONB), so no new tables needed
- **Hidden nav** — Bottom navigation bar is hidden during onboarding for a clean, focused experience

## Wishlist
- **Separate view** — Toggle between owned items and wishlist
- **Same features** — Wishlist items support all the same tagging and filtering
- **Add via share** — Share product images from shopping apps directly to Clossie

## Haptic Feedback
- **Light vibration (15ms)** — Fires on toggles and selections (owned/wishlist switch, outfit builder item picks)
- **Success vibration (20ms)** — Fires on saves and confirmations (save item, log wear, favorite, laundry toggle)
- **Error vibration (50ms)** — Fires on destructive actions (item delete)
- **Automatic via toasts** — Most haptics are triggered centrally through the toast system, so any action that shows a toast also vibrates
- **Silent fallback** — On devices that don't support the Vibration API (like Safari on iOS), haptics are silently skipped with no errors

## PWA Features
- **Installable** — Add to home screen on iOS/Android
- **Share target** — Native share sheet integration for receiving images
- **App icon** — Custom Clossie icon at 192px and 512px

## Authentication
- **Email/password** — Sign up with email confirmation
- **Session management** — Auto-detects expired sessions and redirects to login
- **Protected routes** — All app pages require authentication
