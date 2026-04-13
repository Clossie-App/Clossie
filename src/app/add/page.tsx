'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import { compressImage } from '@/lib/image-compression';
import {
  ClothingCategory, Season, Occasion,
  CATEGORY_LABELS, CATEGORY_ICONS, SEASON_LABELS, OCCASION_LABELS,
} from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'capture' | 'detecting' | 'select' | 'extracting' | 'review' | 'error';

interface DetectedItem {
  id: string;
  label: string;
  category: ClothingCategory;
  box: [number, number, number, number]; // [y_min, x_min, y_max, x_max] normalized 0–1000
  selected: boolean;
}

interface AiTags {
  category: ClothingCategory;
  subcategory: string | null;
  color: string;
  secondary_color: string | null;
  season: Season;
  occasion: Occasion;
}

interface ReviewCard {
  id: string;
  imageBlob: Blob;
  imageUrl: string;
  tags: AiTags;
  brand: string;
  size: string;
  price: string;
  notes: string;
  isWishlist: boolean;
}

// ─── Page wrapper (required for useSearchParams) ──────────────────────────────

export default function AddItemPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" />
      </div>
    }>
      <AddItemContent />
    </Suspense>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function AddItemContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useSearchParams(); // keeps share_target working
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('capture');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImageEl, setOriginalImageEl] = useState<HTMLImageElement | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [extractingProgress, setExtractingProgress] = useState({ current: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnAvailable, setTryOnAvailable] = useState<boolean | null>(null); // null = unknown

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Clean up object URLs on unmount — use a Set so URLs created at any point are always captured
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // ─── File validation ──────────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    const name = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') ||
      name.endsWith('.heic') || name.endsWith('.heif') ||
      name.endsWith('.jpg') || name.endsWith('.jpeg') ||
      name.endsWith('.png') || name.endsWith('.webp');
    if (!isImage) return "That file isn't an image. Please choose a photo.";
    if (file.size > 15 * 1024 * 1024) return 'That photo is too large (max 15MB). Try a smaller one.';
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    e.target.value = '';
    if (!file) { console.error('[Add] No file selected'); return; }
    console.log('[Add] File selected:', file.name, file.type, file.size, 'bytes');
    const err = validateFile(file);
    if (err) { console.error('[Add] Validation error:', err); showToast(err, 'error'); return; }

    // Convert HEIC/HEIF to JPEG (iPhone default format, not supported in most browsers)
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        setStep('detecting');
        setStatusMessage('Converting photo format...');
        const heic2any = (await import('heic2any')).default;
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }) as Blob;
        file = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      } catch {
        showToast('Could not convert this photo format. Try taking a screenshot instead.', 'error');
        setStep('capture');
        return;
      }
    }

    startDetection(file);
  };

  // ─── Step 1: Detect items ─────────────────────────────────────────────────

  const startDetection = async (file: File) => {
    setOriginalFile(file);
    setStep('detecting');
    setStatusMessage('Finding clothing items...');
    setErrorMessage('');

    try {
      // Load image element — needed for canvas drawing and cropping
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });
      setOriginalImageEl(img);

      // Compress image before sending to AI (faster, cheaper, fewer timeouts)
      setStatusMessage('Analyzing clothing...');
      const compressed = await compressImage(file, 1024, 0.85);
      const compressedBase64 = await blobToBase64(compressed);
      const detectCtrl = new AbortController();
      const detectTimeout = setTimeout(() => detectCtrl.abort(), 120000); // 2min for local Ollama
      const res = await fetch('/api/ai/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compressedBase64, mimeType: 'image/jpeg' }),
        signal: detectCtrl.signal,
      });
      clearTimeout(detectTimeout);

      const { items }: { items: DetectedItem[] } = await res.json();

      if (!items || items.length === 0) {
        setDetectedItems([]);
        setStep('select');
        showToast('No items detected — draw around what you want to add', 'info');
        return;
      }

      setDetectedItems(items); // all auto-selected by the API
      setStep('select');
    } catch (err) {
      const msg = !navigator.onLine
        ? "You're offline. Check your connection and try again."
        : err instanceof DOMException && err.name === 'AbortError'
        ? 'Analysis took too long. Try a simpler photo or check your connection.'
        : 'Could not analyse this photo. Please try again.';
      setErrorMessage(msg);
      setStep('error');
    }
  };

  // ─── Step 2: Extract selected items ───────────────────────────────────────

  const handleExtract = async () => {
    const selected = detectedItems.filter(i => i.selected);
    if (selected.length === 0) { showToast('Select at least one item first', 'error'); return; }
    if (!originalImageEl) return;

    setStep('extracting');
    setExtractingProgress({ current: 0, total: selected.length });

    const cards: ReviewCard[] = [];

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setExtractingProgress({ current: i + 1, total: selected.length });
      setStatusMessage(`Processing item ${i + 1} of ${selected.length}...`);

      try {
        const cropBlob = await cropItem(originalImageEl, item.box);

        const bgForm = new FormData();
        bgForm.append('image', cropBlob, 'crop.png');
        const bgCtrl = new AbortController();
        const bgTimeout = setTimeout(() => bgCtrl.abort(), 60000); // 1min for bg removal
        const bgRes = await fetch('/api/ai/remove-bg', { method: 'POST', body: bgForm, signal: bgCtrl.signal });
        clearTimeout(bgTimeout);
        const cleanBlob = bgRes.ok ? await bgRes.blob() : cropBlob;

        const base64 = await blobToBase64(cleanBlob);
        const catCtrl = new AbortController();
        const catTimeout = setTimeout(() => catCtrl.abort(), 120000); // 2min for local Ollama
        const catRes = await fetch('/api/ai/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
          signal: catCtrl.signal,
        });
        clearTimeout(catTimeout);

        const tags: AiTags = catRes.ok ? await catRes.json() : {
          category: item.category,
          subcategory: null,
          color: '#808080',
          secondary_color: null,
          season: 'all-season',
          occasion: 'casual',
        };

        cards.push({
          id: item.id,
          imageBlob: cleanBlob,
          imageUrl: (() => { const u = URL.createObjectURL(cleanBlob); objectUrlsRef.current.add(u); return u; })(),
          tags,
          brand: '',
          size: '',
          price: '',
          notes: '',
          isWishlist: false,
        });
      } catch {
        showToast(`Skipped item ${i + 1} — could not process`, 'error');
      }
    }

    if (cards.length === 0) {
      setErrorMessage('Could not extract any items. Please try again.');
      setStep('error');
      return;
    }

    setReviewCards(cards);
    setCurrentCardIndex(0);
    setShowDetails(false);
    setStep('review');
  };

  // ─── Step 3: Review card actions ──────────────────────────────────────────

  const updateCard = (field: keyof ReviewCard, value: string | boolean | AiTags) => {
    setReviewCards(prev => prev.map((c, i) => i === currentCardIndex ? { ...c, [field]: value } : c));
  };

  const handleNextCard = () => {
    setShowDetails(false);
    setTryOnImage(null);
    setCurrentCardIndex(i => i + 1);
  };

  // ─── Step 4: Save all ─────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      let savedCount = 0;

      for (const card of reviewCards) {
        try {
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
          const { error: uploadError } = await supabase.storage
            .from('clothing-images')
            .upload(fileName, card.imageBlob, { contentType: 'image/png' });
          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('clothing-images').getPublicUrl(fileName);
          if (!publicUrl) throw new Error('No public URL returned from storage');

          const { error: dbError } = await supabase.from('clothing_items').insert({
            user_id: user.id,
            image_url: publicUrl,
            thumbnail_url: publicUrl,
            category: card.tags.category,
            subcategory: card.tags.subcategory,
            color: card.tags.color,
            secondary_color: card.tags.secondary_color,
            season: card.tags.season,
            occasion: card.tags.occasion,
            brand: card.brand || null,
            size: card.size || null,
            price: card.price ? parseFloat(card.price) : null,
            notes: card.notes || null,
            is_favorite: false,
            in_laundry: false,
            is_wishlist: card.isWishlist,
            wear_count: 0,
          }).select().single();
          if (dbError) throw dbError;
          savedCount++;
        } catch (err) {
          console.error(`Failed to save item "${card.tags.category}":`, err);
          showToast(`Failed to save ${card.tags.subcategory || card.tags.category}`, 'error');
        }
      }

      if (savedCount === 0) {
        showToast('Could not save any items. Please try again.', 'error');
        return;
      }

      haptics.success();
      showToast(
        savedCount === reviewCards.length
          ? `${savedCount} item${savedCount > 1 ? 's' : ''} added to your closet!`
          : `${savedCount} of ${reviewCards.length} items saved`,
        'success'
      );
      router.push('/closet');
    } finally {
      setSaving(false);
    }
  };

  // ─── Try-On: generate flatlay view via local MLX SD ────────────────────────

  const handleTryOn = async () => {
    if (!currentCard) return;
    setTryOnLoading(true);
    setTryOnImage(null);
    try {
      const base64 = await blobToBase64(currentCard.imageBlob);
      const res = await fetch('/api/ai/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          description: currentCard.tags.subcategory || currentCard.tags.category,
        }),
      });
      const data = await res.json();
      if (data.serverOffline) {
        setTryOnAvailable(false);
        showToast('Try-on server not running. Start it with: bash scripts/start-tryon.sh', 'info');
        return;
      }
      if (data.image) {
        setTryOnImage(`data:image/png;base64,${data.image}`);
        setTryOnAvailable(true);
      } else {
        showToast('Could not generate try-on view', 'error');
      }
    } catch {
      showToast('Try-on generation failed', 'error');
    } finally {
      setTryOnLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading) return null;

  const currentCard = reviewCards[currentCardIndex];
  const isLastCard = currentCardIndex === reviewCards.length - 1;
  const selectedCount = detectedItems.filter(i => i.selected).length;
  const cardsRemaining = reviewCards.length - currentCardIndex - 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => ['select', 'review'].includes(step) ? setStep('capture') : router.back()}
            className="text-gray-400 p-1"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {step === 'select' ? 'Select Items' :
             step === 'review' ? `Review ${currentCardIndex + 1} of ${reviewCards.length}` :
             'Add Item'}
          </h1>
          <div className="w-8" />
        </div>
      </div>

      {/* ── Capture ── */}
      {step === 'capture' && (
        <div className="flex flex-col items-center justify-center px-6 py-16">
          <div className="w-48 h-48 bg-gray-100 rounded-3xl flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-20 h-20 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Add to your closet</h2>
          <p className="text-gray-400 text-center text-sm mb-6">
            Take a photo or upload. Clossie finds each item — tap to select what you want to keep.
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
              className="flex-1 py-3.5 bg-clossie-600 text-white rounded-xl font-semibold active:scale-95 transition"
            >
              Take Photo
            </button>
            <button
              onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-95 transition"
            >
              Upload
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={handleFileSelect} className="hidden" />
        </div>
      )}

      {/* ── Detecting ── */}
      {step === 'detecting' && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Finding clothing items...</p>
          <p className="text-gray-400 text-sm mt-1">Just a sec</p>
        </div>
      )}

      {/* ── Select ── */}
      {step === 'select' && originalImageEl && (
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-500 text-center">
            {detectedItems.length === 0
              ? '✏️ No items detected — trace around each item below to add it'
              : `${selectedCount} of ${detectedItems.length} item${detectedItems.length !== 1 ? 's' : ''} selected — tap to toggle, or trace to add more`}
          </p>
          <SelectionCanvas
            imageEl={originalImageEl}
            detectedItems={detectedItems}
            onToggle={(id) => setDetectedItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i))}
            onAddManual={(box) => setDetectedItems(prev => [...prev, {
              id: `manual-${Date.now()}`,
              label: 'Item',
              category: 'other',
              box,
              selected: true,
            }])}
          />
          <button
            onClick={handleExtract}
            disabled={selectedCount === 0}
            className="w-full py-4 bg-clossie-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-40 shadow-lg shadow-clossie-200"
          >
            {selectedCount > 0
              ? `Extract ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`
              : 'Select an item'}
          </button>
        </div>
      )}

      {/* ── Extracting ── */}
      {step === 'extracting' && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">{statusMessage || 'Extracting...'}</p>
          <p className="text-gray-400 text-sm mt-1">Removing background & identifying</p>
          {extractingProgress.total > 1 && (
            <div className="w-48 bg-gray-100 rounded-full h-1.5 mt-4">
              <div
                className="bg-clossie-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(extractingProgress.current / extractingProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Review — card stack ── */}
      {step === 'review' && currentCard && (
        <div className="px-4 py-4">

          {/* Stack visual */}
          <div className="relative mb-4" style={{ paddingBottom: Math.min(cardsRemaining, 2) * 10 }}>
            {/* Cards peeking behind */}
            {reviewCards.slice(currentCardIndex + 1, currentCardIndex + 3).map((_, stackIndex) => (
              <div
                key={stackIndex}
                className="absolute inset-x-0 bg-white rounded-3xl border border-gray-100"
                style={{
                  top: (stackIndex + 1) * 10,
                  marginLeft: (stackIndex + 1) * 5,
                  marginRight: (stackIndex + 1) * 5,
                  height: 380,
                  zIndex: 10 - stackIndex,
                  opacity: 1 - stackIndex * 0.2,
                }}
              />
            ))}

            {/* Current card */}
            <div className="relative bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden" style={{ zIndex: 20 }}>
              {/* Image + Try On */}
              <div className="bg-gray-50 relative" style={{ height: tryOnImage ? 300 : 260 }}>
                {tryOnImage ? (
                  /* Side-by-side: original + generated flatlay */
                  <div className="flex h-full">
                    <div className="flex-1 flex items-center justify-center border-r border-gray-100">
                      <div className="text-center">
                        <img src={currentCard.imageUrl} alt="Original" className="object-contain mx-auto" style={{ maxHeight: 240, maxWidth: '100%' }} />
                        <p className="text-[10px] text-gray-400 mt-1">Original</p>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <img src={tryOnImage} alt="Flatlay" className="object-contain mx-auto" style={{ maxHeight: 240, maxWidth: '100%' }} />
                        <p className="text-[10px] text-gray-400 mt-1">Flatlay</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <img src={currentCard.imageUrl} alt="Clothing item" className="object-contain" style={{ maxHeight: 230, maxWidth: '100%' }} />
                  </div>
                )}
                {/* Try On button */}
                {tryOnAvailable !== false && !tryOnImage && (
                  <button
                    onClick={handleTryOn}
                    disabled={tryOnLoading}
                    className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-full font-medium bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-50"
                  >
                    {tryOnLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </span>
                    ) : '✨ Try On'}
                  </button>
                )}
                {tryOnImage && (
                  <button
                    onClick={() => setTryOnImage(null)}
                    className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-full font-medium bg-white text-gray-800 shadow-sm transition"
                  >
                    ✕ Close
                  </button>
                )}
              </div>

              {/* AI tags summary */}
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{CATEGORY_ICONS[currentCard.tags.category]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{CATEGORY_LABELS[currentCard.tags.category]}</p>
                    {currentCard.tags.subcategory && (
                      <p className="text-xs text-gray-500 truncate">{currentCard.tags.subcategory}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: currentCard.tags.color }} />
                    <span className="text-xs text-gray-500">{currentCard.tags.color}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {SEASON_LABELS[currentCard.tags.season]}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {OCCASION_LABELS[currentCard.tags.occasion]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Edit tags */}
          <button
            onClick={() => setShowDetails(d => !d)}
            className="w-full text-center text-sm text-gray-400 py-1"
          >
            {showDetails ? 'Hide details' : 'Edit tags or add details'}
          </button>

          {showDetails && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4 mt-2">
              {/* Owned / Wishlist */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => { haptics.light(); updateCard('isWishlist', false); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${!currentCard.isWishlist ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                  I Own This
                </button>
                <button onClick={() => { haptics.light(); updateCard('isWishlist', true); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${currentCard.isWishlist ? 'bg-white text-clossie-600 shadow-sm' : 'text-gray-500'}`}>
                  Wishlist
                </button>
              </div>
              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
                    <button key={cat}
                      onClick={() => updateCard('tags', { ...currentCard.tags, category: cat })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${currentCard.tags.category === cat ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Season */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Season</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
                    <button key={s}
                      onClick={() => updateCard('tags', { ...currentCard.tags, season: s })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${currentCard.tags.season === s ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {SEASON_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Occasion */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Occasion</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                    <button key={o}
                      onClick={() => updateCard('tags', { ...currentCard.tags, occasion: o })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${currentCard.tags.occasion === o ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {OCCASION_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color"
                    value={currentCard.tags.color.startsWith('#') ? currentCard.tags.color : '#808080'}
                    onChange={(e) => updateCard('tags', { ...currentCard.tags, color: e.target.value })}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer" />
                  <input type="text" value={currentCard.tags.color}
                    onChange={(e) => updateCard('tags', { ...currentCard.tags, color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white" />
                </div>
              </div>
              {/* Extras */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Brand</label>
                  <input type="text" value={currentCard.brand} onChange={(e) => updateCard('brand', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="Nike, Zara..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Size</label>
                  <input type="text" value={currentCard.size} onChange={(e) => updateCard('size', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="S, M, 8..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Price</label>
                <input type="number" min="0" step="0.01" value={currentCard.price} onChange={(e) => updateCard('price', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="$29.99" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea value={currentCard.notes} onChange={(e) => updateCard('notes', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" rows={2} placeholder="Runs small, dry clean only..." />
              </div>
            </div>
          )}

          {/* Action */}
          <div className="mt-4 space-y-2">
            {isLastCard ? (
              <button onClick={handleSaveAll} disabled={saving}
                className="w-full py-4 bg-clossie-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50 shadow-lg shadow-clossie-200">
                {saving ? 'Saving...' : `Save All ${reviewCards.length} Item${reviewCards.length !== 1 ? 's' : ''}`}
              </button>
            ) : (
              <button onClick={handleNextCard}
                className="w-full py-4 bg-clossie-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition shadow-lg shadow-clossie-200">
                Looks Good →
              </button>
            )}
            <p className="text-center text-xs text-gray-400">
              {isLastCard
                ? 'Saves all items at once'
                : `${cardsRemaining} more item${cardsRemaining !== 1 ? 's' : ''} to review`}
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Something went wrong</h3>
          <p className="text-gray-400 text-center text-sm mb-6">{errorMessage}</p>
          <div className="flex gap-3 w-full max-w-xs">
            <button onClick={() => originalFile && startDetection(originalFile)}
              className="flex-1 py-3.5 bg-clossie-600 text-white rounded-xl font-semibold active:scale-95 transition">
              Try Again
            </button>
            <button onClick={() => { setStep('capture'); setErrorMessage(''); setOriginalFile(null); }}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-95 transition">
              New Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Selection Canvas with shimmering outlines ────────────────────────────────

function SelectionCanvas({
  imageEl,
  detectedItems,
  onToggle,
  onAddManual,
}: {
  imageEl: HTMLImageElement;
  detectedItems: DetectedItem[];
  onToggle: (id: string) => void;
  onAddManual: (box: [number, number, number, number]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const animTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const itemsRef = useRef(detectedItems);
  itemsRef.current = detectedItems;

  const [drawMode, setDrawMode] = useState(false);
  const drawModeRef = useRef(false);
  drawModeRef.current = drawMode;
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);

  // Auto-enter draw mode when no items detected
  const autoDrawRef = useRef(false);
  useEffect(() => {
    if (detectedItems.length === 0 && !autoDrawRef.current) {
      autoDrawRef.current = true;
      setDrawMode(true);
    }
  }, [detectedItems.length]);

  // Size canvas to image aspect ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const w = canvas.parentElement.clientWidth;
    canvas.width = w;
    canvas.height = Math.round(w * (imageEl.naturalHeight / imageEl.naturalWidth));
  }, [imageEl]);

  // Continuous animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (timestamp: number) => {
      const delta = timestamp - (lastTimeRef.current || timestamp);
      lastTimeRef.current = timestamp;
      animTimeRef.current += delta;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const items = itemsRef.current;

      // Dim the base image when items are detected
      ctx.globalAlpha = items.length > 0 ? 0.38 : 1;
      ctx.drawImage(imageEl, 0, 0, width, height);
      ctx.globalAlpha = 1;

      // Draw selected items at full brightness — the "lift" effect
      for (const item of items) {
        if (!item.selected) continue;
        const { px, py, pw, ph } = toPixels(item.box, width, height);
        const { nx, ny, nw, nh } = toNatural(item.box, imageEl);
        ctx.drawImage(imageEl, nx, ny, nw, nh, px, py, pw, ph);
      }

      // Shimmering outlines
      for (const item of items) {
        drawOutline(ctx, item, animTimeRef.current, width, height);
      }

      // Freehand lasso path for manual draw mode
      if (drawModeRef.current && lassoPointsRef.current.length > 1) {
        const pts = lassoPointsRef.current;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (!isDrawingRef.current) { ctx.lineTo(pts[0].x, pts[0].y); } // close path when done
        ctx.stroke();
        ctx.restore();

        // Draw start point indicator
        if (pts.length > 0 && isDrawingRef.current) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [imageEl]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.changedTouches[0].clientX - rect.left) * sx, y: (e.changedTouches[0].clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawModeRef.current) return;
    if ('touches' in e) e.preventDefault(); // Prevent scroll on iPhone during draw
    const pos = getPos(e);
    lassoPointsRef.current = [pos];
    isDrawingRef.current = true;
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawModeRef.current || !isDrawingRef.current) return;
    if ('touches' in e) e.preventDefault(); // Prevent scroll on iPhone during draw
    const pos = getPos(e);
    const pts = lassoPointsRef.current;
    // Only add point if it's far enough from the last one (prevents excessive density)
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dist = Math.sqrt((pos.x - last.x) ** 2 + (pos.y - last.y) ** 2);
      if (dist < 3) return; // skip if too close
    }
    lassoPointsRef.current.push(pos);
  };

  const handlePointerUp = () => {
    if (!drawModeRef.current || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pts = lassoPointsRef.current;

    if (pts.length < 5) { lassoPointsRef.current = []; return; } // too few points

    // Compute bounding box from lasso points
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // Check if area is meaningful (at least 20x20 canvas pixels)
    if ((maxX - minX) > 20 && (maxY - minY) > 20) {
      onAddManual([
        Math.round((minY / canvas.height) * 1000),
        Math.round((minX / canvas.width) * 1000),
        Math.round((maxY / canvas.height) * 1000),
        Math.round((maxX / canvas.width) * 1000),
      ]);
      setDrawMode(false);
    }
    lassoPointsRef.current = [];
  };

  const handleClick = (e: React.MouseEvent) => {
    if (drawModeRef.current) return;
    const { x, y } = getPos(e);
    const canvas = canvasRef.current!;
    for (const item of itemsRef.current) {
      const { px, py, pw, ph } = toPixels(item.box, canvas.width, canvas.height);
      if (x >= px && x <= px + pw && y >= py && y <= py + ph) { onToggle(item.id); return; }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (drawModeRef.current) { handlePointerUp(); return; }
    const { x, y } = getPos(e);
    const canvas = canvasRef.current!;
    for (const item of itemsRef.current) {
      const { px, py, pw, ph } = toPixels(item.box, canvas.width, canvas.height);
      if (x >= px && x <= px + pw && y >= py && y <= py + ph) { onToggle(item.id); return; }
    }
  };

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-black transition-all ${drawMode ? 'ring-2 ring-clossie-400 ring-offset-2 ring-offset-gray-50' : ''}`}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ cursor: drawMode ? 'crosshair' : 'pointer', touchAction: 'none' }}
        onClick={handleClick}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handleTouchEnd}
      />
      <button
        onClick={() => { setDrawMode(d => !d); lassoPointsRef.current = []; isDrawingRef.current = false; }}
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-sm px-5 py-2.5 rounded-full font-semibold transition shadow-lg ${
          drawMode
            ? 'bg-white text-gray-800 shadow-white/20'
            : 'bg-white/90 text-gray-800 shadow-black/20 backdrop-blur-sm'
        }`}
      >
        {drawMode ? '✕ Done Tracing' : '✏️ Trace Item'}
      </button>
      {drawMode && (
        <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
          <span className="bg-black/70 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm font-medium">
            Draw around the item with your finger
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function toPixels(box: [number, number, number, number], w: number, h: number) {
  const [y1, x1, y2, x2] = box;
  return { px: (x1 / 1000) * w, py: (y1 / 1000) * h, pw: ((x2 - x1) / 1000) * w, ph: ((y2 - y1) / 1000) * h };
}

function toNatural(box: [number, number, number, number], img: HTMLImageElement) {
  const [y1, x1, y2, x2] = box;
  return {
    nx: (x1 / 1000) * img.naturalWidth,
    ny: (y1 / 1000) * img.naturalHeight,
    nw: ((x2 - x1) / 1000) * img.naturalWidth,
    nh: ((y2 - y1) / 1000) * img.naturalHeight,
  };
}

function posOnRect(x: number, y: number, w: number, h: number, dist: number): [number, number] {
  const perim = 2 * (w + h);
  dist = ((dist % perim) + perim) % perim;
  if (dist < w) return [x + dist, y];
  dist -= w;
  if (dist < h) return [x + w, y + dist];
  dist -= h;
  if (dist < w) return [x + w - dist, y + h];
  dist -= w;
  return [x, y + h - dist];
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  item: DetectedItem,
  animTime: number,
  width: number,
  height: number
) {
  const { px, py, pw, ph } = toPixels(item.box, width, height);
  const r = 10;
  const sel = item.selected;

  // Rounded rect path for the glowing border
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + pw - r, py);
  ctx.arcTo(px + pw, py, px + pw, py + r, r);
  ctx.lineTo(px + pw, py + ph - r);
  ctx.arcTo(px + pw, py + ph, px + pw - r, py + ph, r);
  ctx.lineTo(px + r, py + ph);
  ctx.arcTo(px, py + ph, px, py + ph - r, r);
  ctx.lineTo(px, py + r);
  ctx.arcTo(px, py, px + r, py, r);
  ctx.closePath();

  ctx.shadowColor = sel ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.45)';
  ctx.shadowBlur = sel ? 22 : 8;
  ctx.strokeStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = sel ? 2.5 : 1.5;
  ctx.stroke();
  ctx.restore();

  // Shimmer comet travelling around the outline
  const speed = sel ? 260 : 85; // pixels per second
  const [sx, sy] = posOnRect(px, py, pw, ph, (animTime * speed) / 1000);
  const size = sel ? 50 : 22;

  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, size);
  g.addColorStop(0, sel ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.42)');
  g.addColorStop(0.3, sel ? 'rgba(210,235,255,0.38)' : 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(sx - size, sy - size, size * 2, size * 2);
  ctx.restore();

  // Label badge above each selected item
  if (sel) {
    ctx.save();
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    const tw = ctx.measureText(item.label).width;
    const bw = tw + 14, bh = 22;
    const bx = px + pw / 2 - bw / 2;
    const by = Math.max(4, py - bh - 5);

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.moveTo(bx + 6, by);
    ctx.lineTo(bx + bw - 6, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + 6, 6);
    ctx.lineTo(bx + bw, by + bh - 6);
    ctx.arcTo(bx + bw, by + bh, bx + bw - 6, by + bh, 6);
    ctx.lineTo(bx + 6, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - 6, 6);
    ctx.lineTo(bx, by + 6);
    ctx.arcTo(bx, by, bx + 6, by, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, px + pw / 2, by + bh / 2);
    ctx.restore();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function cropItem(imageEl: HTMLImageElement, box: [number, number, number, number]): Promise<Blob> {
  const { nx, ny, nw, nh } = toNatural(box, imageEl);
  const c = document.createElement('canvas');
  c.width = Math.round(nw);
  c.height = Math.round(nh);
  c.getContext('2d')!.drawImage(imageEl, nx, ny, nw, nh, 0, 0, nw, nh);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Crop timed out')), 10000);
    c.toBlob(b => {
      clearTimeout(timer);
      b ? resolve(b) : reject(new Error('Crop failed'));
    }, 'image/png');
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
