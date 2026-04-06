export interface Mood {
  id: string;
  label: string;
  emoji: string;
  description: string;
  gradient: string;
  promptHint: string;
}

export const MOODS: Mood[] = [
  {
    id: 'powerful',
    label: 'Powerful',
    emoji: '\u{1F525}',
    description: 'Walk in like you own it',
    gradient: 'from-red-500 to-orange-500',
    promptHint:
      'Use bold, saturated colors (reds, blacks, deep jewel tones). Prefer structured silhouettes — blazers, tailored pants, clean lines. Include one statement piece. The outfit should communicate confidence and authority.',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    emoji: '\u{2601}\uFE0F',
    description: 'Soft, warm, wrapped up',
    gradient: 'from-amber-400 to-yellow-300',
    promptHint:
      'Use warm, soft tones (cream, camel, blush, soft gray). Prefer oversized or relaxed fits — chunky knits, wide pants, layered textures. Prioritize comfort without looking sloppy.',
  },
  {
    id: 'main-character',
    label: 'Main Character',
    emoji: '\u{2728}',
    description: 'All eyes on you',
    gradient: 'from-fuchsia-500 to-purple-600',
    promptHint:
      'Go bold with high contrast and unexpected combinations. Include at least one standout statement piece. Mix patterns or textures. The outfit should look curated and intentional, like the protagonist of a movie.',
  },
  {
    id: 'professional-badass',
    label: 'Professional Badass',
    emoji: '\u{1F4BC}',
    description: 'Polished but dangerous',
    gradient: 'from-slate-600 to-slate-800',
    promptHint:
      'Neutral palette (black, white, navy, gray, camel) with clean, tailored lines. Include one unexpected detail — a bold shoe, a textured bag, or a pop of color in an accessory. The look should be office-appropriate but with edge.',
  },
  {
    id: 'casual-cool',
    label: 'Casual Cool',
    emoji: '\u{1F60E}',
    description: 'Effortlessly put together',
    gradient: 'from-sky-400 to-blue-500',
    promptHint:
      'Relaxed, tonal dressing. Stick to 2-3 colors in the same family. Prefer relaxed but intentional fits. Minimal accessories. The outfit should look like you put it together in 5 minutes but it looks amazing.',
  },
  {
    id: 'date-night',
    label: 'Date Night',
    emoji: '\u{1F496}',
    description: 'You look incredible',
    gradient: 'from-rose-500 to-pink-600',
    promptHint:
      'Use rich, romantic colors (deep reds, burgundy, emerald, black). Prefer flattering silhouettes that define the shape. Include intentional details — nice jewelry, a special bag, or a textured top. The look should feel special and confident.',
  },
  {
    id: 'weekend-warrior',
    label: 'Weekend Warrior',
    emoji: '\u{26A1}',
    description: 'Ready for anything',
    gradient: 'from-green-500 to-teal-500',
    promptHint:
      'Comfortable but put-together layers. Versatile pieces that work for errands, brunch, or a spontaneous adventure. Practical footwear. The outfit should be easy to move in while still looking good.',
  },
];

export function getMoodById(id: string): Mood | undefined {
  return MOODS.find((m) => m.id === id);
}

export function getRandomMood(): Mood {
  return MOODS[Math.floor(Math.random() * MOODS.length)];
}
