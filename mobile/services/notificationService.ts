import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Request notification permissions from user
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    try {
        if (!Device.isDevice) {
            console.log("Must use physical device for Push Notifications");
            return false;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            console.log("Failed to get push token for push notification!");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error requesting notification permissions:", error);
        return false;
    }
}

/**
 * Get Expo push token for this device
 * @returns {Promise<string | null>} - Expo push token or null
 */
export async function getExpoPushToken(): Promise<string | null> {
    try {
        if (!Device.isDevice) {
            console.log("Must use physical device for Push Notifications");
            return null;
        }

        const token = await Notifications.getExpoPushTokenAsync({
            projectId: "your-project-id", // Will be auto-filled by Expo
        });

        console.log("Expo Push Token:", token.data);
        return token.data;
    } catch (error) {
        console.error("Error getting push token:", error);
        return null;
    }
}

/**
 * Register push token with backend
 * @param {string} token - Expo push token
 * @param {Function} apiPost - API post function from useApi hook
 * @returns {Promise<boolean>} - True if registration successful
 */
export async function registerPushTokenWithBackend(
    token: string,
    apiPost: any
): Promise<boolean> {
    try {
        await apiPost("/users/push-token", { expoPushToken: token });
        console.log("Push token registered with backend");
        return true;
    } catch (error) {
        console.error("Error registering push token with backend:", error);
        return false;
    }
}

/**
 * Setup notification listeners
 * @returns {Object} - Subscription objects
 */
export function setupNotificationListeners() {
    // Handle notification received while app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
            console.log("Notification received in foreground:", notification);
            // Notification will be displayed automatically
        }
    );

    // Handle notification tap
    const responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
            const data = response.notification.request.content.data;
            console.log("Notification tapped, data:", data);

            // Navigate to order detail if orderId is present
            if (data.orderId) {
                handleNotificationNavigation(data.orderId as string);
            }
        }
    );

    return {
        notificationListener,
        responseListener,
    };
}

/**
 * Handle navigation when notification is tapped
 * @param {string} orderId - Order ID from notification
 */
function handleNotificationNavigation(orderId: string) {
    try {
        // Navigate to orders screen
        // The orders screen will handle showing the specific order if needed
        router.push("/(profile)/orders");
    } catch (error) {
        console.error("Error navigating from notification:", error);
    }
}

/**
 * Initialize notification system
 * @param {Function} apiPost - API post function
 * @returns {Promise<void>}
 */
export async function initializeNotifications(apiPost: any): Promise<void> {
    try {
        // Request permissions
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission) {
            console.log("Notification permission denied");
            return;
        }

        // Get push token
        const token = await getExpoPushToken();
        if (!token) {
            console.log("Failed to get push token");
            return;
        }

        // Register with backend
        await registerPushTokenWithBackend(token, apiPost);

        // Setup listeners
        const listeners = setupNotificationListeners();

        console.log("Notification system initialized successfully");
    } catch (error) {
        console.error("Error initializing notifications:", error);
    }
}

// Configure notification channel for Android
if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("order-updates", {
        name: "Order Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1DB954",
    });
}
