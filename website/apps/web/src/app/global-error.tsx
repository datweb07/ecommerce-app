'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import './globals.css';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront layout error', { digest: error.digest });
  }, [error]);
  return (
    <html lang="vi">
      <body>
        <main className="mx-auto max-w-lg px-5 py-16">
          <h1 className="text-3xl font-bold">Không thể tải website</h1>
          <div className="mt-5 flex gap-4">
            <button
              type="button"
              onClick={reset}
              className="rounded-control bg-primary px-4 py-2 text-primary-foreground"
            >
              Thử lại
            </button>
            <Link href="/" className="rounded-control px-4 py-2 underline">
              Về trang chủ
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
