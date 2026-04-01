# Database Schema

Clossie uses Supabase (Postgres) with the following tables. All tables use Row Level Security (RLS) scoped to `auth.uid()`.

## Tables

### `clothing_items`

Main inventory table for all closet items.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References auth.users |
| `image_url` | text | Full-size image in Supabase Storage |
| `thumbnail_url` | text | null | Smaller version for grid display |
| `category` | text | tops, bottoms, dresses, outerwear, shoes, bags, accessories, jewelry, activewear, other |
| `subcategory` | text | null | Finer detail (e.g., "v-neck", "crop top", "sneakers") |
| `color` | text | Primary color name or hex |
| `secondary_color` | text | null | Secondary/accent color |
| `season` | text | spring, summer, fall, winter, all-season |
| `occasion` | text | casual, work, going-out, formal, athletic, lounge |
| `brand` | text | null | Brand name |
| `size` | text | null | Size label |
| `price` | numeric | null | Purchase price |
| `notes` | text | null | User notes |
| `is_favorite` | boolean | false | Favorited item |
| `in_laundry` | boolean | false | Currently in the wash |
| `is_wishlist` | boolean | false | Wishlist vs owned |
| `wear_count` | integer | 0 | Times worn (auto-incremented via outfit logging) |
| `last_worn_at` | timestamptz | null | Last time this item was worn |
| `created_at` | timestamptz | now() | When the item was added |

### `outfits`

Saved outfit combinations.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References auth.users |
| `name` | text | Outfit name |
| `occasion` | text | null | Occasion tag |
| `season` | text | null | Season tag |
| `is_favorite` | boolean | false | Favorited outfit |
| `created_at` | timestamptz | now() | |

### `outfit_items`

Junction table linking outfits to clothing items.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `outfit_id` | uuid | References outfits |
| `clothing_item_id` | uuid | References clothing_items |
| `position` | integer | null | Display order |

### `wear_log`

History of when outfits were worn.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References auth.users |
| `outfit_id` | uuid | References outfits |
| `worn_date` | date | The date the outfit was worn |
| `created_at` | timestamptz | now() | |

## Storage

### `clothing-images` bucket

Public bucket for clothing item photos. Images are stored with the path pattern:
```
{user_id}/{timestamp}-{filename}.png
```

## Relationships

```
clothing_items ←── outfit_items ──→ outfits
                                        ↑
                                    wear_log
```

- One outfit has many outfit_items (each pointing to a clothing_item)
- One clothing_item can appear in many outfits
- Logging a wear creates a wear_log entry AND increments wear_count on all items in that outfit
