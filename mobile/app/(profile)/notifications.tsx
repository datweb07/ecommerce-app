import SafeScreen from "@/components/SafeScreen";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const NotificationsScreen = () => {
    return (
        <SafeScreen>
            {/* HEADER */}
            <View className="px-6 pb-5 border-b border-surface flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text className="text-text-primary text-2xl font-bold">
                    Notifications
                </Text>
            </View>

            {/* SIMPLE COMING SOON MESSAGE */}
            <View className="flex-1 items-center justify-center p-6">
                <View className="bg-primary/20 rounded-full w-20 h-20 items-center justify-center mb-6">
                    <Ionicons name="construct-outline" size={40} color="#1DB954" />
                </View>
                <Text className="text-text-primary text-2xl font-bold mt-6 mb-3">
                    Coming Soon
                </Text>
                <Text className="text-text-secondary text-center text-base">
                    This feature is currently in development
                </Text>
                <Text className="text-text-secondary text-center text-sm mt-2">
                    Will be available in a future update
                </Text>
            </View>
        </SafeScreen>
    );
};

export default NotificationsScreen;