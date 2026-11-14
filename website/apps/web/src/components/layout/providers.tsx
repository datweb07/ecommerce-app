'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { viVN } from '@clerk/localizations';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { publicEnv } from '../../config/public-env';
import { makeQueryClient } from '../../lib/query';
import { Toaster } from '../ui/sonner';

function Queries({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
function SessionQueries({ children }: { children: ReactNode }) {
  const { userId, sessionId } = useAuth();
  return <Queries key={sessionId ?? userId ?? 'guest'}>{children}</Queries>;
}
function Authentication({ children }: { children: ReactNode }) {
  if (!publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    return <Queries>{children}</Queries>;
  return (
    <ClerkProvider
      localization={viVN}
      allowedRedirectOrigins={[publicEnv.NEXT_PUBLIC_SITE_URL]}
      appearance={{
        variables: {
          colorPrimary: 'var(--primary)',
          colorPrimaryForeground: 'var(--primary-foreground)',
          colorForeground: 'var(--foreground)',
          colorBackground: 'var(--card)',
          colorInput: 'var(--card)',
          colorInputForeground: 'var(--foreground)',
          colorNeutral: 'var(--foreground)',
          colorMutedForeground: 'var(--muted-foreground)',
          borderRadius: 'var(--radius)',
        },
      }}
    >
      <SessionQueries>{children}</SessionQueries>
    </ClerkProvider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Authentication>{children}</Authentication>
      <Toaster />
    </ThemeProvider>
  );
}
