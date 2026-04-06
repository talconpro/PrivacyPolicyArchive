import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Privacy Policy Archive',
  description: 'Archive and track app privacy policy changes with risk scoring and historical snapshots.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'),
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
              Privacy Policy Archive
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-700">
              <Link href="/" className="hover:text-slate-900 hover:underline">
                Home
              </Link>
              <Link href="/apps" className="hover:text-slate-900 hover:underline">
                Browse
              </Link>
              <Link href="/compare" className="hover:text-slate-900 hover:underline">
                Compare
              </Link>
            </nav>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/about" className="hover:text-slate-900 hover:underline">
                About
              </Link>
              <Link href="/methodology" className="hover:text-slate-900 hover:underline">
                Methodology
              </Link>
              <Link href="/disclaimer" className="hover:text-slate-900 hover:underline">
                Disclaimer
              </Link>
              <Link href="/contact" className="hover:text-slate-900 hover:underline">
                Contact
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              AI-generated analysis for reference only. This site does not provide legal advice.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
