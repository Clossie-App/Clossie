'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * KAN-13: Pull-to-refresh hook for mobile.
 * Returns touch handlers and state for rendering a pull indicator.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const active = useRef(false);

  const THRESHOLD = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return; // Only at top of page
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!active.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPulling(true);
      setPullDistance(Math.min(dy * 0.4, 80)); // Dampen the pull
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    active.current = false;
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(40); // Hold spinner position
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { active.current = false; };
  }, []);

  return {
    pulling: pulling || refreshing,
    pullDistance,
    refreshing,
    handlers: { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd },
  };
}
