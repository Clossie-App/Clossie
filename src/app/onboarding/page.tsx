'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const STEPS = [
  {
    emoji: '👋',
    title: (name: string) => `Welcome to Clossie${name ? `, ${name}` : ''}!`,
    subtitle: 'Your smart closet organizer',
    description:
      'Photograph your clothes, and let AI organize everything. Build outfits, track what you wear, and never wonder "what should I wear?" again.',
    bg: 'from-clossie-50 to-white',
  },
  {
    emoji: '📸',
    title: () => 'AI does the heavy lifting',
    subtitle: 'Snap a photo, we handle the rest',
    description:
      'Take a photo of any clothing item. AI instantly removes the background and tags it by category, color, season, and occasion.',
    bg: 'from-purple-50 to-white',
  },
  {
    emoji: '👗',
    title: () => 'Get outfit suggestions',
    subtitle: 'Your personal AI stylist',
    description:
      'AI analyzes your wardrobe and suggests complete outfits. Track what you wear on the calendar and discover your style stats.',
    bg: 'from-pink-50 to-white',
  },
  {
    emoji: '✨',
    title: () => 'What\'s your style vibe?',
    subtitle: 'Help the AI understand you',
    description: '',
    bg: 'from-amber-50 to-white',
    isQuiz: true,
  },
  {
    emoji: '🚀',
    title: () => 'Ready to build your closet?',
    subtitle: 'Start with your first item',
    description:
      'Add a clothing item and watch the AI work its magic. It only takes a few seconds!',
    bg: 'from-clossie-50 to-white',
    isFinal: true,
  },
];

const STYLE_OPTIONS = [
  { id: 'casual', emoji: '👟', label: 'Casual & Comfy' },
  { id: 'classic', emoji: '👔', label: 'Classic & Polished' },
  { id: 'streetwear', emoji: '🧢', label: 'Streetwear' },
  { id: 'boho', emoji: '🌻', label: 'Boho & Free' },
  { id: 'minimalist', emoji: '⬜', label: 'Minimalist' },
  { id: 'glam', emoji: '💎', label: 'Glam & Bold' },
];

interface StepDef {
  emoji: string;
  title: (name: string) => string;
  subtitle: string;
  description: string;
  bg: string;
  isFinal?: boolean;
  isQuiz?: boolean;
}

export default function OnboardingPage() {
  const { user, loading, onboarded, completeOnboarding } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && onboarded) router.replace('/closet');
  }, [user, loading, onboarded, router]);

  const goToStep = useCallback(
    (next: number) => {
      if (next < 0 || next >= STEPS.length || transitioning) return;
      setTransitioning(true);
      setTimeout(() => {
        setStep(next);
        setTransitioning(false);
      }, 200);
    },
    [transitioning]
  );

  const saveStylePrefs = () => {
    if (selectedStyles.size > 0) {
      try { localStorage.setItem('clossie-styles', JSON.stringify([...selectedStyles])); } catch {}
    }
  };

  const handleSkip = async () => {
    saveStylePrefs();
    await completeOnboarding();
    router.replace('/closet');
  };

  const handleAddFirst = async () => {
    saveStylePrefs();
    await completeOnboarding();
    router.push('/add');
  };

  const handleExplore = async () => {
    saveStylePrefs();
    await completeOnboarding();
    router.replace('/closet');
  };

  // Touch swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchRef.current.startX;
    const deltaY = e.changedTouches[0].clientY - touchRef.current.startY;
    touchRef.current = null;

    // Only swipe if horizontal movement is dominant
    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < 0) {
      goToStep(step + 1);
    } else {
      goToStep(step - 1);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
      </div>
    );
  }

  const current = STEPS[step];
  const name = user.user_metadata?.full_name?.split(' ')[0] || '';

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`min-h-screen bg-gradient-to-b ${current.bg} flex flex-col transition-colors duration-300`}
    >
      {/* Skip button */}
      {!current.isFinal && (
        <div className="flex justify-end p-4">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 px-3 py-1"
          >
            Skip
          </button>
        </div>
      )}
      {current.isFinal && <div className="h-12" />}

      {/* Content */}
      <div
        className={`flex-1 flex flex-col items-center justify-center px-8 transition-opacity duration-200 ${
          transitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="text-7xl mb-6">{current.emoji}</div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {current.title(name)}
        </h1>
        <p className="text-clossie-600 font-medium text-center mb-4">
          {current.subtitle}
        </p>
        {current.description && (
          <p className="text-gray-500 text-center text-sm leading-relaxed max-w-xs">
            {current.description}
          </p>
        )}

        {/* Style quiz */}
        {(current as StepDef).isQuiz && (
          <div className="mt-4 w-full max-w-xs">
            <p className="text-gray-400 text-xs text-center mb-3">Pick all that fit you (you can change later)</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((style) => {
                const selected = selectedStyles.has(style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyles(prev => {
                        const next = new Set(prev);
                        if (next.has(style.id)) next.delete(style.id);
                        else next.add(style.id);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition ${
                      selected ? 'bg-clossie-100 text-clossie-700 ring-2 ring-clossie-400' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span className="text-lg">{style.emoji}</span>
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Final step buttons */}
        {current.isFinal && (
          <div className="mt-8 w-full max-w-xs space-y-3">
            <button
              onClick={handleAddFirst}
              className="w-full py-3.5 bg-clossie-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition"
            >
              Add Your First Item
            </button>
            <button
              onClick={handleExplore}
              className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm active:scale-[0.98] transition"
            >
              Explore First
            </button>
          </div>
        )}
      </div>

      {/* Bottom: dots + next button */}
      <div className="pb-12 px-8">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-clossie-600'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Next button (not on final step) */}
        {!current.isFinal && (
          <button
            onClick={() => goToStep(step + 1)}
            className="w-full py-3.5 bg-clossie-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition"
          >
            {step === STEPS.length - 2 ? "Let's Go" : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}
