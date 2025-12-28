import { Stack } from "expo-router";
import "../global.css";
import Constants from "expo-constants";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";

import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import * as Sentry from "@sentry/react-native";

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

/* ================== ROOT ================== */
export default Sentry.wrap(function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ClerkProvider>
  );
});
