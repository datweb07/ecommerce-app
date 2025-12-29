import SafeScreen from "@/components/SafeScreen";
import { useUser } from "@clerk/clerk-expo";
import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useProfile } from "@/hooks/useProfile";
import * as Haptics from "expo-haptics";

const EditProfileScreen = () => {
  const { user } = useUser();
  const { profile, isLoading: profileLoading, updateProfile, isUpdating } = useProfile();

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    bio: "",
    phoneNumber: "",
  });

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        bio: profile.bio || "",
        phoneNumber: profile.phoneNumber || "",
      }));
    }
  }, [profile]);

  // Track changes - check against both Clerk and backend data
  useEffect(() => {
    const clerkChanged =
      formData.firstName !== (user?.firstName || "") ||
      formData.lastName !== (user?.lastName || "");

    const backendChanged =
      formData.bio !== (profile?.bio || "") ||
      formData.phoneNumber !== (profile?.phoneNumber || "");

    setHasChanges(clerkChanged || backendChanged);
  }, [formData, user, profile]);

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant photo library access to change your profile picture"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageLoading(true);
        try {
          // Clerk requires base64 encoded image
          const base64Image = result.assets[0].base64;
          if (!base64Image) {
            throw new Error("Failed to get base64 image");
          }

          await user?.setProfileImage({
            file: `data:image/jpeg;base64,${base64Image}`,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Success", "Profile picture updated successfully!");
        } catch (error: any) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "Error",
            error?.message || "Failed to update profile picture"
          );
          console.error("Image upload error:", error);
        } finally {
          setImageLoading(false);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to open image picker");
    }
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      Alert.alert("Validation Error", "First name is required");
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert("Validation Error", "Last name is required");
      return false;
    }
    if (formData.bio.length > 500) {
      Alert.alert("Validation Error", "Bio must be 500 characters or less");
      return false;
    }
    if (formData.phoneNumber && !/^[\d\s\-\+\(\)]+$/.test(formData.phoneNumber)) {
      Alert.alert("Validation Error", "Please enter a valid phone number");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Update Clerk data (firstName, lastName only - username not supported)
      await user?.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      // Update backend data (bio, phoneNumber)
      await updateProfile({
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error?.errors?.[0]?.message || error?.message || "Failed to update profile"
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (profileLoading) {
    return (
      <SafeScreen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1DB954" />
          <Text className="text-text-secondary mt-4">Loading profile...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}
          <View className="px-6 pb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="size-10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-text-primary text-xl font-bold">
              Edit Profile
            </Text>
            <View className="size-10" />
          </View>

          {/* PROFILE IMAGE */}
          <View className="items-center mb-8">
            <View className="relative">
              <Image
                source={user?.imageUrl}
                style={{ width: 120, height: 120, borderRadius: 60 }}
                transition={200}
              />
              {imageLoading && (
                <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                  <ActivityIndicator color="#1DB954" />
                </View>
              )}
              <TouchableOpacity
                onPress={handleImagePick}
                className="absolute -bottom-2 -right-2 bg-primary rounded-full size-12 items-center justify-center border-4 border-background"
                activeOpacity={0.7}
                disabled={imageLoading}
              >
                <Ionicons name="camera" size={20} color="#121212" />
              </TouchableOpacity>
            </View>
            <Text className="text-text-secondary text-sm mt-3">
              Tap to change profile picture
            </Text>
          </View>

          {/* FORM */}
          <View className="px-6">
            {/* First Name */}
            <View className="mb-5">
              <Text className="text-text-primary font-semibold mb-2 ml-1">
                First Name <Text className="text-red-500">*</Text>
              </Text>
              <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center">
                <Ionicons name="person-outline" size={20} color="#666" />
                <TextInput
                  className="flex-1 ml-3 text-text-primary text-base"
                  value={formData.firstName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, firstName: text })
                  }
                  placeholder="Enter first name"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Last Name */}
            <View className="mb-5">
              <Text className="text-text-primary font-semibold mb-2 ml-1">
                Last Name <Text className="text-red-500">*</Text>
              </Text>
              <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center">
                <Ionicons name="person-outline" size={20} color="#666" />
                <TextInput
                  className="flex-1 ml-3 text-text-primary text-base"
                  value={formData.lastName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, lastName: text })
                  }
                  placeholder="Enter last name"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Email (Read Only) */}
            <View className="mb-5">
              <Text className="text-text-primary font-semibold mb-2 ml-1">
                Email
              </Text>
              <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center opacity-50">
                <Ionicons name="mail-outline" size={20} color="#666" />
                <Text className="flex-1 ml-3 text-text-secondary text-base">
                  {user?.emailAddresses?.[0]?.emailAddress || "No email"}
                </Text>
                <Ionicons name="lock-closed" size={16} color="#666" />
              </View>
              <Text className="text-text-secondary text-xs mt-1 ml-1">
                Email cannot be changed here
              </Text>
            </View>

            {/* Phone Number */}
            <View className="mb-5">
              <Text className="text-text-primary font-semibold mb-2 ml-1">
                Phone Number
              </Text>
              <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center">
                <Ionicons name="call-outline" size={20} color="#666" />
                <TextInput
                  className="flex-1 ml-3 text-text-primary text-base"
                  value={formData.phoneNumber}
                  onChangeText={(text) =>
                    setFormData({ ...formData, phoneNumber: text })
                  }
                  placeholder="Enter phone number"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Bio */}
            <View className="mb-8">
              <View className="flex-row items-center justify-between mb-2 ml-1">
                <Text className="text-text-primary font-semibold">Bio</Text>
                <Text
                  className={`text-xs ${formData.bio.length > 500
                    ? "text-red-500"
                    : "text-text-secondary"
                    }`}
                >
                  {formData.bio.length}/500
                </Text>
              </View>
              <View className="bg-surface rounded-2xl px-4 py-4">
                <TextInput
                  className="text-text-primary text-base min-h-[100px]"
                  value={formData.bio}
                  onChangeText={(text) =>
                    setFormData({ ...formData, bio: text })
                  }
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              className={`rounded-2xl py-5 items-center justify-center mb-4 ${hasChanges ? "bg-primary" : "bg-surface"
                }`}
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={loading || isUpdating || !hasChanges}
            >
              {loading || isUpdating ? (
                <ActivityIndicator color="#121212" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={hasChanges ? "#121212" : "#666"}
                  />
                  <Text
                    className={`font-bold text-base ml-2 ${hasChanges ? "text-background" : "text-text-secondary"
                      }`}
                  >
                    Save Changes
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* CANCEL BUTTON */}
            <TouchableOpacity
              className="bg-surface rounded-2xl py-5 items-center justify-center border border-text-secondary/20"
              activeOpacity={0.8}
              onPress={handleBack}
              disabled={loading || isUpdating}
            >
              <Text className="text-text-primary font-semibold text-base">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

export default EditProfileScreen;
