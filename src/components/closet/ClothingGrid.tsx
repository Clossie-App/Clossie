'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClothingItem } from '@/lib/types';
import Link from 'next/link';

interface EmptyAction {
  label: string;
  href: string;
}

interface ClothingGridProps {
  items: ClothingItem[];
  loading: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: EmptyAction;
  onDelete?: (id: string) => Promise<boolean>;
  onToggleLaundry?: (item: ClothingItem) => void;
  onToggleFavorite?: (item: ClothingItem) => void;
}

export default function ClothingGrid({
  items,
  loading,
  emptyIcon = '\uD83D\uDC57',
  emptyTitle = 'No items yet',
  emptyDescription = 'Tap the + button to add your first clothing item',
  emptyAction,
  onDelete,
  onToggleLaundry,
  onToggleFavorite,
}: ClothingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 px-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="text-5xl mb-4">{emptyIcon}</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{emptyTitle}</h3>
        <p className="text-gray-400 text-center text-sm mb-4">{emptyDescription}</p>
        {emptyAction && (
          <a
            href={emptyAction.href}
            className="px-6 py-2.5 bg-clossie-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
          >
            {emptyAction.label}
          </a>
        )}
      </div>
    );
  }

  const interactive = !!(onDelete || onToggleLaundry || onToggleFavorite);

  return (
    <div className="grid grid-cols-3 gap-2 px-4">
      {items.map((item) =>
        interactive ? (
          <SwipeableCard
            key={item.id}
            item={item}
            onDelete={onDelete}
            onToggleLaundry={onToggleLaundry}
            onToggleFavorite={onToggleFavorite}
          />
        ) : (
          <StaticCard key={item.id} item={item} />
        )
      )}
    </div>
  );
}

function StaticCard({ item }: { item: ClothingItem }) {
  return (
    <Link
      href={`/closet/${item.id}`}
      className="group relative aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 active:scale-95 transition-transform"
    >
      <CardContent item={item} />
    </Link>
  );
}

function CardContent({ item, showHeart }: { item: ClothingItem; showHeart?: boolean }) {
  return (
    <>
      <img
        src={item.image_url}
        alt={item.subcategory || item.category}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onLoad={(e) => (e.target as HTMLImageElement).classList.add('loaded')}
      />
      {item.is_favorite && <div className="absolute top-1.5 right-1.5 text-sm">&#x2764;&#xFE0F;</div>}
      {item.is_wishlist && (
        <div className="absolute top-1.5 left-1.5 bg-clossie-100 text-clossie-600 text-xs px-1.5 py-0.5 rounded-full font-medium">Want</div>
      )}
      {!item.is_wishlist && item.in_laundry && (
        <div className="absolute top-1.5 left-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-medium">Wash</div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
        <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: item.color }} />
      </div>
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping-once">
          <span className="text-3xl">{item.is_favorite ? '\uD83E\uDD0D' : '\u2764\uFE0F'}</span>
        </div>
      )}
    </>
  );
}

const SWIPE_THRESHOLD = 50;
const LONG_PRESS_MS = 500;

function SwipeableCard({
  item, onDelete, onToggleLaundry, onToggleFavorite,
}: {
  item: ClothingItem;
  onDelete?: (id: string) => Promise<boolean>;
  onToggleLaundry?: (item: ClothingItem) => void;
  onToggleFavorite?: (item: ClothingItem) => void;
}) {
  const router = useRouter();
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const isScrolling = useRef(false);
  // Mirror offsetX in a ref so handleTouchEnd always reads the latest value
  // regardless of React batching between touchmove and touchend events
  const offsetXRef = useRef(0);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (heartTimer.current) clearTimeout(heartTimer.current);
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isLongPress.current = false;
    isScrolling.current = false;

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (onToggleFavorite) {
        onToggleFavorite(item);
        setShowHeart(true);
        heartTimer.current = setTimeout(() => setShowHeart(false), 600);
      }
    }, LONG_PRESS_MS);
  }, [item, onToggleFavorite]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (!isScrolling.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      isScrolling.current = true;
      clearLongPress();
      return;
    }
    if (Math.abs(dx) > 10) clearLongPress();
    if (isScrolling.current) return;

    if (swiped) {
      const next = Math.min(0, -90 + dx);
      offsetXRef.current = next;
      setOffsetX(next);
    } else {
      const next = Math.min(0, dx);
      offsetXRef.current = next;
      setOffsetX(next);
    }
  }, [swiped, clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    if (isScrolling.current) { isScrolling.current = false; return; }
    if (isLongPress.current) { isLongPress.current = false; return; }

    if (offsetXRef.current < -SWIPE_THRESHOLD) {
      offsetXRef.current = -90;
      setOffsetX(-90);
      setSwiped(true);
    } else {
      offsetXRef.current = 0;
      setOffsetX(0);
      setSwiped(false);
      setConfirming(false);
    }
  }, [clearLongPress]);

  const handleTap = useCallback(() => {
    if (swiped) { setOffsetX(0); setSwiped(false); setConfirming(false); return; }
    if (isLongPress.current) return;
    const elapsed = Date.now() - touchStartTime.current;
    if (elapsed < LONG_PRESS_MS && Math.abs(offsetX) < 5) {
      router.push(`/closet/${item.id}`);
    }
  }, [swiped, offsetX, item.id, router]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    if (!confirming) { setConfirming(true); return; }
    await onDelete(item.id);
  }, [confirming, item.id, onDelete]);

  const handleLaundry = useCallback(() => {
    if (onToggleLaundry) onToggleLaundry(item);
    setOffsetX(0);
    setSwiped(false);
  }, [item, onToggleLaundry]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-stretch justify-end rounded-2xl overflow-hidden">
        <button onClick={handleLaundry} className="w-[45px] flex items-center justify-center bg-blue-500 text-white"
          aria-label={item.in_laundry ? 'Remove from laundry' : 'Mark as laundry'}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button onClick={handleDelete} className={`w-[45px] flex items-center justify-center text-white transition-colors ${confirming ? 'bg-red-700' : 'bg-red-500'}`}
          aria-label="Delete item">
          {confirming ? (
            <span className="text-xs font-bold">Yes?</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
        </button>
      </div>

      <div role="link" tabIndex={0}
        className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-gray-100 transition-transform will-change-transform"
        style={{ transform: `translateX(${offsetX}px)`, transition: offsetX === 0 || offsetX === -90 ? 'transform 0.2s ease-out' : 'none', touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={handleTap}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/closet/${item.id}`); } }}>
        <div className="relative w-full h-full overflow-hidden rounded-2xl">
          <CardContent item={item} showHeart={showHeart} />
        </div>
      </div>
    </div>
  );
}
