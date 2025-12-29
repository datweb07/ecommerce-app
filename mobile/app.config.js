// export default {
//   expo: {
//     name: "anonymous",
//     slug: "anonymous",

//     scheme: "anonymous",

//     android: {
//       package: "com.dat82770.anonymous",
//     },

//     extra: {
//       clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
//     },
//   },
// };

export default {
  expo: {
    name: "ShopEase",
    slug: "shopease",
    version: "1.0.0",

    scheme: "anonymous",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    icon: "./assets/images/icon.png",

    splash: {
      image: "./assets/images/auth-image.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    ios: {
      supportsTablet: true,
    },

    android: {
      package: "com.dat82770.anonymous",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundColor: "#8B5CF6",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "react-native",
          organization: "ueh-university",
        },
      ],
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.dat82770.anonymous",
          enableGooglePay: false,
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      router: {},
      eas: {
        projectId: "87ded972-59c1-4896-8cb8-b95bba6db264",
      },
    },
  },
};
