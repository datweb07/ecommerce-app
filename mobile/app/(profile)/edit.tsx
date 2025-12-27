import SafeScreen from "@/components/SafeScreen";
import { useUser } from "@clerk/clerk-expo";
import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

const EditProfileScreen = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    username: user?.username || "",
    phone: user?.phoneNumbers?.[0]?.phoneNumber || "",
  });

  const handleImagePick = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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
      });

      if (!result.canceled && result.assets[0]) {
        setImageLoading(true);
        try {
          await user?.setProfileImage({
            file: result.assets[0].uri,
          });
          Alert.alert("Success", "Profile picture updated successfully!");
        } catch (error) {
          Alert.alert("Error", "Failed to update profile picture");
          console.error(error);
        } finally {
          setImageLoading(false);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to open image picker");
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      await user?.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
      });

      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.errors?.[0]?.message || "Failed to update profile"
      );
      console.error(error);
    } finally {
      setLoading(false);
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
        <View className="px-6 pb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
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
                <ActivityIndicator color="#3B82F6" />
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
              First Name
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
              Last Name
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

          {/* Username */}
          <View className="mb-5">
            <Text className="text-text-primary font-semibold mb-2 ml-1">
              Username
            </Text>
            <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center">
              <Ionicons name="at" size={20} color="#666" />
              <TextInput
                className="flex-1 ml-3 text-text-primary text-base"
                value={formData.username}
                onChangeText={(text) =>
                  setFormData({ ...formData, username: text })
                }
                placeholder="Enter username"
                placeholderTextColor="#666"
                autoCapitalize="none"
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

          {/* Phone */}
          <View className="mb-8">
            <Text className="text-text-primary font-semibold mb-2 ml-1">
              Phone Number
            </Text>
            <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center">
              <Ionicons name="call-outline" size={20} color="#666" />
              <TextInput
                className="flex-1 ml-3 text-text-primary text-base"
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
                placeholder="Enter phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            className="bg-primary rounded-2xl py-5 items-center justify-center mb-4"
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={22} color="#121212" />
                <Text className="text-background font-bold text-base ml-2">
                  Save Changes
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* CANCEL BUTTON */}
          <TouchableOpacity
            className="bg-surface rounded-2xl py-5 items-center justify-center border border-text-secondary/20"
            activeOpacity={0.8}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-text-primary font-semibold text-base">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeScreen>
  );
};

export default EditProfileScreen;
