import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 p-1" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Privacy Policy</h1>
        </div>
      </div>
      <div className="p-6 max-w-lg mx-auto space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p className="text-xs text-gray-400">Last updated: April 2, 2026</p>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">What We Collect</h2>
          <p>Clossie collects only what you provide: your email address for authentication, clothing photos you upload, and the tags/categories you assign. We do not collect location data, contacts, or browsing history.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">How We Use Your Data</h2>
          <p>Your photos and clothing data are used solely to power your personal closet experience — categorization, outfit suggestions, and wardrobe stats. We never sell or share your data with third parties for advertising.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">AI Processing</h2>
          <p>When you add items, your photos are sent to Google Gemini for categorization and clothing detection. Processing is governed by Google's API data usage policies. We recommend reviewing Google's terms for details on data handling.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Data Storage</h2>
          <p>Your data is stored securely in Supabase (PostgreSQL database and cloud storage) with row-level security ensuring only you can access your items. Photos are stored in a private bucket accessible only through authenticated requests.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Your Rights</h2>
          <p>You can export all your data at any time from Settings. You can delete your account and all associated data permanently from Settings &gt; Delete Account. We honor deletion requests immediately.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Contact</h2>
          <p>Questions about your privacy? Email us at <a href="mailto:support@clossie.app" className="text-clossie-600 underline">support@clossie.app</a>.</p>
        </section>
      </div>
    </div>
  );
}
