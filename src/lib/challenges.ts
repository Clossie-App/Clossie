export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  duration: number; // days
  rules: string[];
  gradient: string;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'no-buy-month',
    name: 'No-Buy Month',
    emoji: '\u{1F6AB}',
    description: 'No new items for 30 days. Love what you already own.',
    duration: 30,
    rules: [
      'No adding new items to your closet for 30 days',
      'Wishlist additions are OK',
      'Check in daily to maintain your streak',
    ],
    gradient: 'from-red-500 to-rose-600',
  },
  {
    id: 'color-week',
    name: 'Color Week',
    emoji: '\u{1F308}',
    description: 'Wear a different color each day for 7 days.',
    duration: 7,
    rules: [
      'Each day, wear a different dominant color',
      'Log your outfit each day to track progress',
      'Try to hit 7 unique colors by the end',
    ],
    gradient: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'capsule-sprint',
    name: 'Capsule Sprint',
    emoji: '\u{1F4BC}',
    description: 'Pick 15 items. Only wear those for 2 weeks.',
    duration: 14,
    rules: [
      'Select exactly 15 items from your closet',
      'Create all outfits from only those 15 items',
      'See how many unique outfits you can make',
    ],
    gradient: 'from-slate-500 to-gray-700',
  },
  {
    id: 'remix-master',
    name: 'Remix Master',
    emoji: '\u{1F504}',
    description: 'Restyle 1 item 7 different ways in a week.',
    duration: 7,
    rules: [
      'Pick one item from your closet',
      'Style it into 7 completely different outfits',
      'Log each outfit to track your remixes',
    ],
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    id: 'dust-collector-rescue',
    name: 'Dust Collector Rescue',
    emoji: '\u{1F9F9}',
    description: 'Wear 10 items you haven\'t touched in 3+ months.',
    duration: 14,
    rules: [
      'Find items not worn in 3 or more months',
      'Wear at least 10 of them in 14 days',
      'Give neglected pieces a second chance',
    ],
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    id: 'monochrome-week',
    name: 'Monochrome Week',
    emoji: '\u{1F3A8}',
    description: 'Each day\'s outfit uses one color family.',
    duration: 7,
    rules: [
      'Each outfit should be within one color family',
      'Tonal variations count (light blue + navy = monochrome)',
      'Try a different color family each day',
    ],
    gradient: 'from-neutral-600 to-neutral-800',
  },
];

export const BADGES: Badge[] = [
  { id: 'first-challenge', name: 'Trailblazer', emoji: '\u{1F31F}', description: 'Completed your first challenge' },
  { id: 'streak-7', name: 'On Fire', emoji: '\u{1F525}', description: '7-day streak' },
  { id: 'streak-30', name: 'Unstoppable', emoji: '\u{1F4AA}', description: '30-day streak' },
  { id: 'no-buy-month', name: 'Mindful Maven', emoji: '\u{1F9D8}', description: 'Completed No-Buy Month' },
  { id: 'color-week', name: 'Rainbow Rider', emoji: '\u{1F308}', description: 'Completed Color Week' },
  { id: 'capsule-sprint', name: 'Capsule Queen', emoji: '\u{1F451}', description: 'Completed Capsule Sprint' },
  { id: 'remix-master', name: 'Remix Genius', emoji: '\u{1F3B6}', description: 'Completed Remix Master' },
  { id: 'dust-collector-rescue', name: 'Closet Hero', emoji: '\u{1F9B8}', description: 'Completed Dust Collector Rescue' },
  { id: 'monochrome-week', name: 'Tonal Master', emoji: '\u{1F3A8}', description: 'Completed Monochrome Week' },
];

export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}
