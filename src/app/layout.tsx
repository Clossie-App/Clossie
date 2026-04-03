import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import SessionGuard from '@/components/ui/SessionGuard';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';

export const metadata: Metadata = {
  title: 'Clossie - Your Smart Closet',
  description: 'AI-powered closet organizer. Snap a photo, get instant outfit ideas, and never ask "what should I wear?" again.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clossie',
  },
  openGraph: {
    title: 'Clossie - Your Smart Closet',
    description: 'AI-powered closet organizer. Snap a photo, get instant outfit ideas.',
    type: 'website',
    siteName: 'Clossie',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clossie - Your Smart Closet',
    description: 'AI-powered closet organizer. Snap a photo, get instant outfit ideas.',
  },
  keywords: ['closet organizer', 'outfit planner', 'AI fashion', 'wardrobe app', 'what to wear'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#c026d3',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <ToastProvider>
            <SessionGuard />
            <main className="pb-20 max-w-lg mx-auto animate-page-enter">
              {children}
            </main>
            <BottomNav />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
