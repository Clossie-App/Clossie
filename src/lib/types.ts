export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'bags'
  | 'accessories'
  | 'jewelry'
  | 'activewear'
  | 'other';

export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'all-season';

export type Occasion = 'casual' | 'work' | 'going-out' | 'formal' | 'athletic' | 'lounge';

export interface ClothingItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url: string | null;
  category: ClothingCategory;
  subcategory: string | null;
  color: string;
  secondary_color: string | null;
  season: Season;
  occasion: Occasion;
  brand: string | null;
  size: string | null;
  price: number | null;
  notes: string | null;
  is_favorite: boolean;
  in_laundry: boolean;
  is_wishlist: boolean;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  occasion: Occasion | null;
  season: Season | null;
  is_favorite: boolean;
  created_at: string;
  items?: ClothingItem[];
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  clothing_item_id: string;
}

export interface WearLog {
  id: string;
  user_id: string;
  outfit_id: string;
  worn_date: string;
}

export interface OutfitSuggestion {
  name: string;
  item_ids: string[];
  reason: string;
}

export interface PackingList {
  id: string;
  user_id: string;
  trip_name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
  jewelry: 'Jewelry',
  activewear: 'Activewear',
  other: 'Other',
};

export const CATEGORY_ICONS: Record<ClothingCategory, string> = {
  tops: '\u{1F455}',
  bottoms: '\u{1F456}',
  dresses: '\u{1F457}',
  outerwear: '\u{1F9E5}',
  shoes: '\u{1F45F}',
  bags: '\u{1F45C}',
  accessories: '\u{1F576}\uFE0F',
  jewelry: '\u{1F48D}',
  activewear: '\u{1FA73}',
  other: '\u{1F4E6}',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  'all-season': 'All Season',
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: 'Casual',
  work: 'Work',
  'going-out': 'Going Out',
  formal: 'Formal',
  athletic: 'Athletic',
  lounge: 'Lounge',
};
