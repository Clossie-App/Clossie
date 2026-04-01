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

## Wishlist
- **Separate view** — Toggle between owned items and wishlist
- **Same features** — Wishlist items support all the same tagging and filtering
- **Add via share** — Share product images from shopping apps directly to Clossie

## PWA Features
- **Installable** — Add to home screen on iOS/Android
- **Share target** — Native share sheet integration for receiving images
- **App icon** — Custom Clossie icon at 192px and 512px

## Authentication
- **Email/password** — Sign up with email confirmation
- **Session management** — Auto-detects expired sessions and redirects to login
- **Protected routes** — All app pages require authentication
