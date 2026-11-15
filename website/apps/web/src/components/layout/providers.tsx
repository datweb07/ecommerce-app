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
        elements: {
          cardBox: {
            boxShadow: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          },
          card: { boxShadow: 'none', backgroundImage: 'none', borderRadius: 0 },
          footer: { background: 'var(--card)' },
          userButtonPopoverCard: {
            boxShadow: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          },
          formButtonPrimary: { boxShadow: 'none', backgroundImage: 'none' },
          socialButtonsBlockButton: { boxShadow: 'none' },
          formFieldInput: {
            boxShadow: 'none',
            borderColor: 'var(--control-border)',
          },
        },
        variables: {
          colorPrimary: 'var(--primary)',
          colorPrimaryForeground: 'var(--primary-foreground)',
          colorForeground: 'var(--foreground)',
          colorBackground: 'var(--card)',
          colorInput: 'var(--background)',
          fontFamily: 'var(--font-inter), Arial, sans-serif',
          colorInputForeground: 'var(--foreground)',
          colorNeutral: 'var(--foreground)',
          colorRing: 'var(--focus)',
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
