import { Stack } from "expo-router";
import "../global.css";
import Constants from "expo-constants";
import { useEffect } from "react";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";

import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import * as Sentry from "@sentry/react-native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { initializeNotifications } from "@/services/notificationService";
import { useApi } from "@/lib/api";

/* ================== SENTRY ================== */
Sentry.init({
  dsn: "https://6a38254d87b2c78e612ae67235360d29@o4510585334792192.ingest.us.sentry.io/4510606399242240",
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],
});

/* ================== CLERK KEY ================== */
const clerkKey = Constants.expoConfig?.extra?.clerkPublishableKey;

if (!clerkKey) {
  throw new Error("Missing Clerk publishable key");
}

/* ================== STRIPE KEY ================== */
const stripeKey = Constants.expoConfig?.extra?.stripePublishableKey;

if (!stripeKey) {
  throw new Error("Missing Stripe publishable key");
}

/* ================== REACT QUERY ================== */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      Sentry.captureException(error, {
        tags: {
          type: "react-query-error",
          queryKey: query.queryKey?.[0]?.toString() || "unknown",
        },
        extra: {
          errorMessage: error.message,
          statusCode: error.response?.status,
          queryKey: query.queryKey,
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      Sentry.captureException(error, {
        tags: { type: "react-query-mutation-error" },
        extra: {
          errorMessage: error.message,
          statusCode: error.response?.status,
        },
      });
    },
  }),
});

/* ================== NOTIFICATION INITIALIZER ================== */
function NotificationInitializer() {
  const api = useApi();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return;

    // Initialize notifications when user is signed in
    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = (await initializeNotifications(api)) as (() => void) | undefined;
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  }, [isSignedIn, api]);

  return null;
}

/* ================== ROOT ================== */
export default Sentry.wrap(function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={stripeKey}>
          <NotificationInitializer />
          <Stack screenOptions={{ headerShown: false }} />
        </StripeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
});
