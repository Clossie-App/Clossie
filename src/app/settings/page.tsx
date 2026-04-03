'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-300 dark:text-gray-600">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-clossie-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function PillSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === opt ? 'bg-clossie-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [compactGrid, setCompactGrid] = useState(false);
  const [defaultSeason, setDefaultSeason] = useState('Auto');
  const [defaultOccasion, setDefaultOccasion] = useState('Casual');
  const [suggestionStyle, setSuggestionStyle] = useState('Classic');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (!user) return;
    setNameInput(user.user_metadata?.full_name || '');
    setDarkMode(localStorage.getItem('clossie-dark') === 'true');
    setCompactGrid(localStorage.getItem('clossie-compact') === 'true');
    setDefaultSeason(localStorage.getItem('clossie-season') || 'Auto');
    setDefaultOccasion(localStorage.getItem('clossie-occasion') || 'Casual');
    setSuggestionStyle(localStorage.getItem('clossie-style') || 'Classic');
  }, [user, authLoading, router]);

  const handleSignOut = async () => { await signOut(); router.replace('/login'); };
  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } });
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Name updated', 'success');
    setEditingName(false);
  };
  const toggleDarkMode = useCallback((on: boolean) => {
    setDarkMode(on);
    document.documentElement.classList.toggle('dark', on);
    localStorage.setItem('clossie-dark', String(on));
  }, []);
  const toggleCompactGrid = useCallback((on: boolean) => {
    setCompactGrid(on);
    localStorage.setItem('clossie-compact', String(on));
  }, []);
  const savePref = useCallback((key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    localStorage.setItem(`clossie-${key}`, value);
  }, []);
  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const supabase = createClient();
      const { data: items } = await supabase.from('clothing_items').select('*').eq('user_id', user.id);
      const { data: outfits } = await supabase.from('outfits').select('*').eq('user_id', user.id);
      const { data: wearLog } = await supabase.from('wear_log').select('*').eq('user_id', user.id);
      const exportObj = { exported_at: new Date().toISOString(), clothing_items: items, outfits, wear_log: wearLog };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `clossie-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported', 'success');
    } catch { showToast('Export failed', 'error'); }
    finally { setExporting(false); }
  };
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') {
      showToast('Type DELETE to confirm', 'error');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      if (!res.ok) throw new Error('Failed');
      const supabase = createClient();
      await supabase.auth.signOut();
      showToast('Account deleted. You have been signed out.', 'success');
      router.replace('/login');
    } catch {
      showToast('Could not delete account. Try again.', 'error');
      setDeleting(false);
    }
    setShowDeleteConfirm(false);
  };

  if (authLoading) return null;
  const userName = user?.user_metadata?.full_name || user?.email || 'User';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>
      <div className="p-4 space-y-4">
        {/* Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          {!editingName ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-clossie-100 dark:bg-clossie-900 rounded-full flex items-center justify-center">
                <span className="text-2xl text-clossie-700">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-800 dark:text-white">{userName}</h2>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
              <button onClick={() => setEditingName(true)} className="text-clossie-600 text-sm font-medium">Edit</button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Display Name</label>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-clossie-500" autoFocus />
              <div className="flex gap-2">
                <button onClick={handleSaveName} className="flex-1 py-2 bg-clossie-600 text-white rounded-xl text-sm font-medium">Save</button>
                <button onClick={() => setEditingName(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium">Cancel</button>
              </div>
            </div>
          )}
        </div>
        {/* My Closet */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">My Closet</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <Link href="/stats" className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4CA;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Closet Insights</span></div><Chevron /></Link>
            <Link href="/calendar" className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4C5;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Wear Calendar</span></div><Chevron /></Link>
            <Link href="/outfits" className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F457;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Outfit History</span></div><Chevron /></Link>
          </div>
        </div>
        {/* Preferences */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">Preferences</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-5">
            <div><p className="text-sm font-medium text-gray-700 dark:text-gray-200">Default Season</p><PillSelect options={['Auto','Spring','Summer','Fall','Winter']} value={defaultSeason} onChange={(v) => savePref('default_season',v,setDefaultSeason)} /></div>
            <div><p className="text-sm font-medium text-gray-700 dark:text-gray-200">Default Occasion</p><PillSelect options={['Casual','Work','Date Night','Active','Formal']} value={defaultOccasion} onChange={(v) => savePref('default_occasion',v,setDefaultOccasion)} /></div>
            <div><p className="text-sm font-medium text-gray-700 dark:text-gray-200">AI Suggestion Style</p><PillSelect options={['Classic','Bold','Mix It Up']} value={suggestionStyle} onChange={(v) => savePref('suggestion_style',v,setSuggestionStyle)} /></div>
          </div>
        </div>
        {/* Appearance */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">Appearance</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F319;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Dark Mode</span></div><Toggle on={darkMode} onChange={toggleDarkMode} /></div>
            <div className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4F1;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Compact Grid</span></div><Toggle on={compactGrid} onChange={toggleCompactGrid} /></div>
          </div>
        </div>
        {/* Data & Privacy */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">Data & Privacy</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <button onClick={handleExportData} disabled={exporting} className="w-full flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4E5;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">{exporting ? 'Exporting...' : 'Export My Data'}</span></div><Chevron /></button>
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F5D1;&#xFE0F;</span><span className="text-sm font-medium text-red-500">Delete Account</span></div><Chevron /></button>
          </div>
        </div>
        {/* About */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">About</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x2728;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Version</span></div><span className="text-xs text-gray-400">1.0.0</span></div>
            <Link href="/privacy" className="w-full flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F512;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Privacy Policy</span></div><Chevron /></Link>
            <Link href="/terms" className="w-full flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4C4;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Terms of Service</span></div><Chevron /></Link>
            <a href="mailto:support@clossie.app" className="flex items-center justify-between px-4 py-3.5"><div className="flex items-center gap-3"><span className="text-lg">&#x1F4AC;</span><span className="text-sm font-medium text-gray-700 dark:text-gray-200">Send Feedback</span></div><Chevron /></a>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center text-red-500 font-medium text-sm">Sign Out</button>
        <p className="text-center text-xs text-gray-300 dark:text-gray-600 pt-2 pb-4">Made with &#x2764;&#xFE0F; by Clossie</p>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowDeleteConfirm(false); setDeleteConfirmText(''); } }}>
          <div role="dialog" aria-modal="true" aria-label="Delete account confirmation"
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Account?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This will permanently delete your account and all your data. This action cannot be undone.</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Type <span className="font-mono text-red-500">DELETE</span> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-40">
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
