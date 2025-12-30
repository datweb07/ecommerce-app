import SafeScreen from "@/components/SafeScreen";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useProfile } from "@/hooks/useProfile";
import { useState } from "react";

const MENU_ITEMS = [
  {
    id: 1,
    icon: "person-outline",
    title: "Edit Profile",
    color: "#3B82F6",
    route: "/(profile)/edit",
  },
  {
    id: 2,
    icon: "list-outline",
    title: "Orders",
    color: "#10B981",
    route: "/orders",
  },
  {
    id: 3,
    icon: "location-outline",
    title: "Addresses",
    color: "#F59E0B",
    route: "/addresses",
  },
  {
    id: 4,
    icon: "heart-outline",
    title: "Wishlist",
    color: "#EF4444",
    route: "/wishlist",
  },
] as const;

const ProfileScreen = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { profile, isLoading: profileLoading } = useProfile();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();

      // router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
      setIsSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  return (
    <SafeScreen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* HEADER */}
        <View className="px-6 pb-8">
          <View className="bg-surface rounded-3xl p-6">
            <View className="flex-row items-center">
              <View className="relative">
                <Image
                  source={user?.imageUrl}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                  transition={200}
                />
                <View className="absolute -bottom-1 -right-1 bg-primary rounded-full size-7 items-center justify-center border-2 border-surface">
                  <Ionicons name="checkmark" size={16} color="#121212" />
                </View>
              </View>

              <View className="flex-1 ml-4">
                <Text className="text-text-primary text-2xl font-bold mb-1">
                  {user?.firstName} {user?.lastName} {profile?.userName ? `(${profile?.userName})` : ""}
                </Text>
                <Text className="text-text-secondary text-sm">
                  {user?.emailAddresses?.[0]?.emailAddress || "No email"}
                </Text>
              </View>
            </View>

            {/* Bio Section */}
            {profileLoading ? (
              <View className="mt-4 pt-4 border-t border-text-secondary/10">
                <ActivityIndicator size="small" color="#666" />
              </View>
            ) : profile?.bio ? (
              <View className="mt-4 pt-4 border-t border-text-secondary/10">
                <Text className="text-text-secondary text-sm leading-5">
                  {profile.bio}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* MENU ITEMS */}
        <View className="flex-row flex-wrap gap-2 mx-6 mb-3">
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="bg-surface rounded-2xl p-6 items-center justify-center"
              style={{ width: "48%" }}
              activeOpacity={0.7}
              onPress={() => handleMenuPress(item.route)}
            >
              <View
                className="rounded-full w-16 h-16 items-center justify-center mb-4"
                style={{ backgroundColor: item.color + "20" }}
              >
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>
              <Text className="text-text-primary font-bold text-base">
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* NOTIFICATIONS BTN */}
        <View className="mb-3 mx-6 bg-surface rounded-2xl p-4">
          <TouchableOpacity
            className="flex-row items-center justify-between py-2"
            activeOpacity={0.7}
            onPress={() => handleMenuPress("/notifications")}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text className="text-text-primary font-semibold ml-3">
                Notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* PRIVACY AND SECURITY LINK */}
        <View className="mb-3 mx-6 bg-surface rounded-2xl p-4">
          <TouchableOpacity
            className="flex-row items-center justify-between py-2"
            activeOpacity={0.7}
            onPress={() => router.push("/privacy-security")}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text className="text-text-primary font-semibold ml-3">
                Privacy & Security
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* SIGNOUT BTN */}
        <TouchableOpacity
          className="mx-6 mb-3 bg-surface rounded-2xl py-5 flex-row items-center justify-center border-2 border-red-500/20"
          activeOpacity={0.7}
          onPress={() => setShowSignOutModal(true)}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text className="text-red-500 font-bold text-base ml-2">
            Sign Out
          </Text>
        </TouchableOpacity>

        <Text className="mx-6 mb-3 text-center text-text-secondary text-xs">
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* SIGN OUT CONFIRMATION MODAL */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-6">
          <View className="bg-surface rounded-3xl p-6 w-full max-w-sm border border-[#2A2A2A]">
            {/* Modal Header */}
            <View className="items-center mb-6">
              <View className="bg-red-500/20 rounded-full w-20 h-20 items-center justify-center mb-4 border border-red-500/30">
                <Ionicons name="log-out-outline" size={36} color="#EF4444" />
              </View>
              <Text className="text-text-primary text-2xl font-bold text-center mb-2">
                Sign Out
              </Text>
              <Text className="text-text-secondary text-center text-sm">
                Are you sure you want to sign out?
              </Text>
            </View>

            {/* Warning Details */}
            <View className="space-y-3 mb-6 bg-[#1a1a1a] rounded-xl p-4 border border-[#2A2A2A]">
              <View className="flex-row items-start">
                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" className="mt-1 mr-2" />
                <Text className="text-gray-300 text-sm flex-1">
                  You will need to sign in again to access your account
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setShowSignOutModal(false)}
                disabled={isSigningOut}
                className="flex-1 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] items-center"
                activeOpacity={0.8}
              >
                <Text className="text-gray-400 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSignOut}
                disabled={isSigningOut}
                className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${isSigningOut ? 'bg-red-700' : 'bg-red-600'
                  }`}
                activeOpacity={0.8}
              >
                {isSigningOut ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="log-out" size={18} color="#fff" />
                    <Text className="text-white font-bold ml-2">Sign Out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
};

export default ProfileScreen;