import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { View, ActivityIndicator } from "react-native";

export default function SSOCallback() {
    const router = useRouter();
    const { isSignedIn, isLoaded } = useAuth();

    useEffect(() => {
        if (isLoaded) {
            if (isSignedIn) {
                // Redirect to main app after successful SSO
                router.replace("/(tabs)");
            } else {
                // If not signed in, go back to auth
                router.replace("/(auth)");
            }
        }
    }, [isLoaded, isSignedIn]);

    return (
        <View className="flex-1 justify-center items-center bg-white">
            <ActivityIndicator size="large" color="#4285f4" />
        </View>
    );
}
