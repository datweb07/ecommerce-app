'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { PageContainer } from '../components/common/page';
import { ErrorState } from '../components/common/states';
import { Button } from '../components/ui/button';
import { ApiError } from '../lib/api/transport';
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront route error', {
      digest: error.digest,
      requestId: error instanceof ApiError ? error.requestId : undefined,
    });
  }, [error]);
  return (
    <PageContainer>
      <ErrorState
        retry={reset}
        action={
          <Button asChild variant="outline">
            <Link href="/">Về trang chủ</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
