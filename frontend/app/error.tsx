'use client';

import { useEffect } from 'react';

/** Shown when a screen crashes, instead of a blank page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-leaf-800">Something went wrong</h1>
      <p className="text-leaf-600">
        This page could not be shown. Try again. If your browser is translating this page, turn that off and use the
        language menu at the top instead.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="min-h-touch rounded-full bg-haldi-600 px-5 font-semibold text-white hover:bg-haldi-700">
          Try again
        </button>
        <a href="/" className="flex min-h-touch items-center rounded-full border border-leaf-800 px-5 font-semibold text-leaf-800">
          Home
        </a>
      </div>
    </main>
  );
}
