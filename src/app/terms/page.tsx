import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 p-1" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Terms of Service</h1>
        </div>
      </div>
      <div className="p-6 max-w-lg mx-auto space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p className="text-xs text-gray-400">Last updated: April 2, 2026</p>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Acceptance</h2>
          <p>By using Clossie, you agree to these terms. If you do not agree, please do not use the app.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Your Account</h2>
          <p>You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use Clossie.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Your Content</h2>
          <p>You retain ownership of all photos and data you upload. By uploading content, you grant Clossie a limited license to process, store, and display it back to you within the app. We do not claim ownership of your content.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Acceptable Use</h2>
          <p>Do not upload content that is illegal, harmful, or violates others' rights. Do not attempt to exploit, reverse-engineer, or abuse the service or its AI features.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">AI Features</h2>
          <p>Outfit suggestions and item categorization are AI-generated and may not always be accurate. Clossie is not liable for fashion advice provided by the AI.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Service Availability</h2>
          <p>Clossie is provided "as is." We strive for uptime but do not guarantee uninterrupted service. We may modify or discontinue features with reasonable notice.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Termination</h2>
          <p>You may delete your account at any time from Settings. We may suspend accounts that violate these terms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Contact</h2>
          <p>Questions? Email <a href="mailto:support@clossie.app" className="text-clossie-600 underline">support@clossie.app</a>.</p>
        </section>
      </div>
    </div>
  );
}
