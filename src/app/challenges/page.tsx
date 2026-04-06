'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import { CHALLENGES, BADGES, getChallengeById, getBadgeById, Challenge } from '@/lib/challenges';
import { createClient } from '@/lib/supabase';

interface UserChallenge {
  id: string;
  challenge_id: string;
  started_at: string;
  ends_at: string;
  status: string;
  progress: Record<string, unknown>;
  streak_count: number;
  completed_at: string | null;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
}

export default function ChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [activeChallenges, setActiveChallenges] = useState<UserChallenge[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<UserChallenge[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [challengeRes, badgeRes] = await Promise.all([
        supabase.from('user_challenges').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_badges').select('*').eq('user_id', user.id).order('earned_at', { ascending: false }),
      ]);

      if (challengeRes.error || badgeRes.error) {
        console.error('Challenge load error:', challengeRes.error?.message || badgeRes.error?.message);
      }

      const challenges = (challengeRes.data || []) as UserChallenge[];
      setActiveChallenges(challenges.filter((c) => c.status === 'active'));
      setCompletedChallenges(challenges.filter((c) => c.status === 'completed'));
      setBadges((badgeRes.data || []) as UserBadge[]);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChallenge = async (challenge: Challenge) => {
    if (!user) return;
    haptics.success();

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + challenge.duration);

    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_challenges').insert({
        user_id: user.id,
        challenge_id: challenge.id,
        ends_at: endsAt.toISOString(),
        progress: {},
        streak_count: 0,
      });

      if (error) {
        console.error('Start challenge error:', error.message);
        showToast('Could not start challenge. Run the SQL migration first.', 'error');
        return;
      }

      showToast(`${challenge.name} started! ${challenge.duration} days to go.`, 'success');
      loadData();
    } catch {
      showToast('Something went wrong.', 'error');
    }
  };

  const activeIds = new Set(activeChallenges.map((c) => c.challenge_id));
  const completedIds = new Set(completedChallenges.map((c) => c.challenge_id));
  const availableChallenges = CHALLENGES.filter((c) => !activeIds.has(c.id));

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => router.back()} aria-label="Go back" className="text-gray-400 text-sm">{'\u2190'} Back</button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Closet Challenges</h1>
        <p className="text-xs text-gray-400 mt-1">Level up your style game</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {/* Active challenges */}
          {activeChallenges.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-1">Active</h2>
              {activeChallenges.map((uc) => {
                const def = getChallengeById(uc.challenge_id);
                if (!def) return null;
                const now = new Date();
                const end = new Date(uc.ends_at);
                const start = new Date(uc.started_at);
                const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const elapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const remaining = Math.max(0, totalDays - elapsed);
                const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));

                return (
                  <div
                    key={uc.id}
                    className={`bg-gradient-to-br ${def.gradient} rounded-2xl p-5 text-white shadow-sm mb-3`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{def.emoji}</span>
                        <h3 className="font-bold text-sm">{def.name}</h3>
                      </div>
                      {uc.streak_count > 0 && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {'\u{1F525}'} {uc.streak_count} day streak
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-90 mb-3">{def.description}</p>

                    {/* Progress bar */}
                    <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                      <div
                        className="bg-white rounded-full h-2 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] opacity-75">
                      <span>Day {elapsed} of {totalDays}</span>
                      <span>{remaining} days left</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-1">Your Badges</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {badges.map((ub) => {
                  const def = getBadgeById(ub.badge_id);
                  if (!def) return null;
                  return (
                    <div
                      key={ub.badge_id}
                      className="flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 text-center w-24"
                    >
                      <div className="text-3xl mb-1">{def.emoji}</div>
                      <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{def.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available challenges */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-1">
              {activeChallenges.length > 0 ? 'More Challenges' : 'Choose a Challenge'}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {availableChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${challenge.gradient} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                      {challenge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">{challenge.name}</h3>
                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          {challenge.duration}d
                        </span>
                        {completedIds.has(challenge.id) && (
                          <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded">
                            {'\u2713'} Done
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{challenge.description}</p>
                      <ul className="mt-2 space-y-0.5">
                        {challenge.rules.map((rule, i) => (
                          <li key={i} className="text-[10px] text-gray-400">{'\u2022'} {rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartChallenge(challenge)}
                    className="mt-3 w-full py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition"
                  >
                    Start Challenge
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Empty state for completed */}
          {activeChallenges.length === 0 && completedChallenges.length === 0 && badges.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{'\u{1F3AF}'}</div>
              <p className="text-sm text-gray-400">Pick your first challenge above and start your style journey!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
