'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import { haptics } from '@/lib/haptics';
import {
  ClothingCategory,
  Season,
  Occasion,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  SEASON_LABELS,
  OCCASION_LABELS,
} from '@/lib/types';

export default function AddItemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin" /></div>}>
      <AddItemContent />
    </Suspense>
  );
}

type Step = 'capture' | 'processing' | 'ready' | 'error';

interface AiTags {
  category: ClothingCategory;
  subcategory: string | null;
  color: string;
  secondary_color: string | null;
  season: Season;
  occasion: Occasion;
}

function AddItemContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('capture');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [tags, setTags] = useState<AiTags | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [isWishlist, setIsWishlist] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Check if this was opened via share
  const isShared = searchParams.get('shared') === 'true';

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Validate file before processing
  const validateFile = (file: File): string | null => {
    const MAX_SIZE_MB = 15;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (!file.type.startsWith('image/')) return 'That file isn\'t an image. Please choose a photo.';
    if (file.size > MAX_SIZE_BYTES) return `That photo is too large (max ${MAX_SIZE_MB}MB). Try a smaller one.`;
    return null;
  };

  // Auto-process: as soon as we have an image, start everything
  const processImage = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    setPendingFile(file);
    setStep('processing');
    setStatusMessage('Removing background...');
    setErrorMessage('');

    try {
      // Background removal
      const { removeBg } = await import('@/lib/background-removal');
      const resultBlob = await removeBg(file as File);
      setProcessedBlob(resultBlob);
      setProcessedImage(URL.createObjectURL(resultBlob));

      // AI categorization
      setStatusMessage('Identifying clothing...');
      const base64 = await blobToBase64(resultBlob);
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (res.ok) {
        setTags(await res.json());
      } else {
        setTags({
          category: 'other',
          subcategory: null,
          color: '#808080',
          secondary_color: null,
          season: 'all-season',
          occasion: 'casual',
        });
      }

      setStep('ready');
    } catch (err) {
      console.error('Processing error:', err);
      const msg = !navigator.onLine
        ? 'You\'re offline. Check your connection and try again.'
        : 'Could not process this photo. Please try again.';
      setErrorMessage(msg);
      setStep('error');
      showToast(msg, 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    // Reset input so same file can be re-selected after an error
    e.target.value = '';
  };

  const handleRetry = () => {
    if (pendingFile) {
      processImage(pendingFile);
    } else {
      setStep('capture');
      setErrorMessage('');
    }
  };

  // Auto-save: one tap and done
  const handleSave = async () => {
    if (!user || !processedBlob || !tags) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const fileName = `${user.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, processedBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clothing-images')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('clothing_items').insert({
        user_id: user.id,
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        category: tags.category,
        subcategory: tags.subcategory,
        color: tags.color,
        secondary_color: tags.secondary_color,
        season: tags.season,
        occasion: tags.occasion,
        brand: brand || null,
        size: size || null,
        price: price ? parseFloat(price) : null,
        notes: notes || null,
        is_favorite: false,
        in_laundry: false,
        is_wishlist: isWishlist,
        wear_count: 0,
      });

      if (dbError) throw dbError;
      showToast(isWishlist ? 'Added to wishlist!' : 'Item added to your closet!', 'success');
      router.push('/closet');
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
      const msg = !navigator.onLine
        ? 'You\'re offline. Check your connection and try again.'
        : 'Could not save item. Please try again.';
      showToast(msg, 'error');
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Add Item</h1>
          <div className="w-8" />
        </div>
      </div>

      {/* Step: Capture */}
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
            Snap a pic or share from any app. We handle the rest!
          </p>

          {/* Owned vs Wishlist toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6 w-full max-w-xs">
            <button
              onClick={() => { haptics.light(); setIsWishlist(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${!isWishlist ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              I Own This
            </button>
            <button
              onClick={() => { haptics.light(); setIsWishlist(true); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${isWishlist ? 'bg-white text-clossie-600 shadow-sm' : 'text-gray-500'}`}
            >
              Wishlist
            </button>
          </div>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 py-3.5 bg-clossie-600 text-white rounded-xl font-semibold active:scale-95 transition"
            >
              Take Photo
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-95 transition"
            >
              Upload
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step: Error with retry */}
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
            <button
              onClick={handleRetry}
              className="flex-1 py-3.5 bg-clossie-600 text-white rounded-xl font-semibold active:scale-95 transition"
            >
              Try Again
            </button>
            <button
              onClick={() => { setStep('capture'); setErrorMessage(''); setPendingFile(null); }}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-95 transition"
            >
              New Photo
            </button>
          </div>
        </div>
      )}

      {/* Step: Processing (fully automatic) */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="w-10 h-10 border-4 border-clossie-200 border-t-clossie-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">{statusMessage}</p>
          <p className="text-gray-400 text-sm mt-1">Just a sec...</p>
        </div>
      )}

      {/* Step: Ready — one tap save */}
      {step === 'ready' && tags && (
        <div className="px-4 py-4 space-y-4">
          {/* Image + AI results side by side */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex gap-4">
              {/* Image */}
              <div className="w-32 h-32 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 p-1">
                {processedImage && (
                  <img src={processedImage} alt="Item" className="w-full h-full object-contain" />
                )}
              </div>

              {/* Auto-detected info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{CATEGORY_ICONS[tags.category]}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{CATEGORY_LABELS[tags.category]}</p>
                    {tags.subcategory && <p className="text-xs text-gray-500">{tags.subcategory}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    <div className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ backgroundColor: tags.color }} />
                    {tags.color}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {SEASON_LABELS[tags.season]}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {OCCASION_LABELS[tags.occasion]}
                  </span>
                </div>

                {isWishlist && (
                  <span className="inline-block mt-2 text-xs bg-clossie-50 text-clossie-600 px-2 py-1 rounded-full font-medium">
                    Wishlist
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Big save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-clossie-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50 shadow-lg shadow-clossie-200"
          >
            {saving ? 'Saving...' : isWishlist ? 'Add to Wishlist' : 'Add to Closet'}
          </button>

          {/* Edit tags (collapsed by default) */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-center text-sm text-gray-400 py-1"
          >
            {showDetails ? 'Hide details' : 'Edit tags or add details'}
          </button>

          {showDetails && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              {/* Owned vs Wishlist */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => { haptics.light(); setIsWishlist(false); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${!isWishlist ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  I Own This
                </button>
                <button
                  onClick={() => { haptics.light(); setIsWishlist(true); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${isWishlist ? 'bg-white text-clossie-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Wishlist
                </button>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTags({ ...tags, category: cat })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        tags.category === cat ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
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
                    <button
                      key={s}
                      onClick={() => setTags({ ...tags, season: s })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        tags.season === s ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
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
                    <button
                      key={o}
                      onClick={() => setTags({ ...tags, occasion: o })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        tags.occasion === o ? 'bg-clossie-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {OCCASION_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={tags.color.startsWith('#') ? tags.color : '#808080'}
                    onChange={(e) => setTags({ ...tags, color: e.target.value })}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={tags.color}
                    onChange={(e) => setTags({ ...tags, color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Optional extras */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Brand</label>
                  <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="Nike, Zara..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Size</label>
                  <input type="text" value={size} onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="S, M, 8..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Price</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" placeholder="$29.99" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mt-1 text-gray-900 bg-white" rows={2} placeholder="Runs small, dry clean only..." />
              </div>
            </div>
          )}

          {/* Add another */}
          <button
            onClick={() => { setStep('capture'); setTags(null); setProcessedImage(null); setShowDetails(false); setPendingFile(null); setErrorMessage(''); }}
            className="w-full text-center text-sm text-clossie-600 font-medium py-2"
          >
            + Add Another Item
          </button>
        </div>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
