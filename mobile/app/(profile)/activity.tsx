import SafeScreen from "@/components/SafeScreen";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from "react-native";

type Activity = {
    id: string;
    type: "login" | "logout" | "password_change" | "profile_update";
    device: string;
    browser: string;
    location: string;
    time: string;
    status: "success" | "failed" | "suspicious";
};

export default function AccountActivityScreen() {
    const [activities, setActivities] = useState<Activity[]>([
        {
            id: "1",
            type: "login",
            device: "iPhone 15 Pro",
            browser: "Safari",
            location: "Hanoi, Vietnam",
            time: "2 minutes ago",
            status: "success"
        },
        {
            id: "2",
            type: "logout",
            device: "MacBook Pro",
            browser: "Chrome",
            location: "Ho Chi Minh City, Vietnam",
            time: "1 hour ago",
            status: "success"
        },
        {
            id: "3",
            type: "login",
            device: "Unknown Device",
            browser: "Firefox",
            location: "Tokyo, Japan",
            time: "3 hours ago",
            status: "suspicious"
        },
        {
            id: "4",
            type: "password_change",
            device: "iPhone 15 Pro",
            browser: "Safari",
            location: "Hanoi, Vietnam",
            time: "1 day ago",
            status: "success"
        },
        {
            id: "5",
            type: "profile_update",
            device: "iPad Air",
            browser: "Safari",
            location: "Hanoi, Vietnam",
            time: "2 days ago",
            status: "success"
        },
        {
            id: "6",
            type: "login",
            device: "Android Phone",
            browser: "Chrome",
            location: "Da Nang, Vietnam",
            time: "1 week ago",
            status: "success"
        }
    ]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const getActivityIcon = (type: Activity["type"]) => {
        switch (type) {
            case "login":
                return "log-in-outline";
            case "logout":
                return "log-out-outline";
            case "password_change":
                return "lock-closed-outline";
            case "profile_update":
                return "person-outline";
            default:
                return "time-outline";
        }
    };

    const getStatusColor = (status: Activity["status"]) => {
        switch (status) {
            case "success":
                return "#10B981"; // green
            case "failed":
                return "#EF4444"; // red
            case "suspicious":
                return "#F59E0B"; // amber
            default:
                return "#6B7280";
        }
    };

    const getStatusText = (status: Activity["status"]) => {
        switch (status) {
            case "success":
                return "Successful";
            case "failed":
                return "Failed";
            case "suspicious":
                return "Suspicious";
            default:
                return "Unknown";
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        // Simulate API call
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const logoutAllDevices = () => {
        // Implement logout all devices logic
        console.log("Logout from all devices");
    };

    return (
        <SafeScreen>
            {/* HEADER */}
            <View className="px-6 pb-5 border-b border-surface flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text className="text-text-primary text-2xl font-bold">
                    Account Activity
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#1DB954"
                        colors={["#1DB954"]}
                    />
                }
            >
                {/* SUMMARY CARD */}
                <View className="px-6 pt-6">
                    <View className="bg-surface rounded-2xl p-5">
                        <Text className="text-text-primary text-lg font-bold mb-3">
                            Activity Summary
                        </Text>
                        <View className="flex-row justify-between">
                            <View className="items-center">
                                <Text className="text-white text-2xl font-bold">{activities.length}</Text>
                                <Text className="text-text-secondary text-xs">Total Activities</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-green-500 text-2xl font-bold">
                                    {activities.filter(a => a.status === "success").length}
                                </Text>
                                <Text className="text-text-secondary text-xs">Successful</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-amber-500 text-2xl font-bold">
                                    {activities.filter(a => a.status === "suspicious").length}
                                </Text>
                                <Text className="text-text-secondary text-xs">Suspicious</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* SECURITY ACTIONS */}
                <View className="px-6 pt-6">
                    <TouchableOpacity
                        onPress={logoutAllDevices}
                        className="bg-surface rounded-2xl p-4 mb-4"
                        activeOpacity={0.7}
                    >
                        <View className="flex-row items-center">
                            <View className="bg-red-500/20 rounded-full w-12 h-12 items-center justify-center mr-4">
                                <Ionicons name="exit-outline" size={24} color="#EF4444" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-text-primary font-bold text-base mb-1">
                                    Logout All Devices
                                </Text>
                                <Text className="text-text-secondary text-sm">
                                    Sign out from all devices except this one
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#666" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ACTIVITY LIST */}
                <View className="px-6 pt-2">
                    <Text className="text-text-primary text-lg font-bold mb-4">
                        Recent Activity
                    </Text>

                    {activities.map((activity) => (
                        <View
                            key={activity.id}
                            className="bg-surface rounded-2xl p-4 mb-3"
                        >
                            <View className="flex-row items-start">
                                <View className="bg-primary/20 rounded-full w-10 h-10 items-center justify-center mr-3 mt-1">
                                    <Ionicons
                                        name={getActivityIcon(activity.type)}
                                        size={20}
                                        color="#1DB954"
                                    />
                                </View>

                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start mb-1">
                                        <Text className="text-text-primary font-bold text-base capitalize">
                                            {activity.type.replace("_", " ")}
                                        </Text>
                                        <View className="flex-row items-center">
                                            <View
                                                className="w-2 h-2 rounded-full mr-2"
                                                style={{ backgroundColor: getStatusColor(activity.status) }}
                                            />
                                            <Text
                                                className="text-xs font-medium"
                                                style={{ color: getStatusColor(activity.status) }}
                                            >
                                                {getStatusText(activity.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="mb-2">
                                        <Text className="text-text-secondary text-sm">
                                            {activity.device} • {activity.browser}
                                        </Text>
                                        <Text className="text-text-secondary text-sm">
                                            {activity.location}
                                        </Text>
                                    </View>

                                    <Text className="text-text-secondary text-xs">
                                        {activity.time}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* INFO */}
                <View className="px-6 pt-4 pb-6">
                    <View className="bg-primary/10 rounded-2xl p-4 flex-row">
                        <Ionicons
                            name="information-circle-outline"
                            size={24}
                            color="#1DB954"
                        />
                        <Text className="text-text-secondary text-sm ml-3 flex-1">
                            Monitor your account activity regularly. Report any suspicious activities immediately.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeScreen>
    );
}