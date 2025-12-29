// import SafeScreen from "@/components/SafeScreen";
// import { Ionicons } from "@expo/vector-icons";
// import { router } from "expo-router";
// import { useState, useEffect } from "react";
// import {
//   ScrollView,
//   Switch,
//   Text,
//   TouchableOpacity,
//   View,
//   Alert,
//   Modal,
//   TextInput,
//   TouchableWithoutFeedback,
//   ActivityIndicator,
// } from "react-native";
// import * as LocalAuthentication from "expo-local-authentication";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type SecurityOption = {
//   id: string;
//   icon: string;
//   title: string;
//   description: string;
//   type: "navigation" | "toggle" | "modal";
//   value?: boolean;
//   route?: string;
// };

// function PrivacyAndSecurityScreen() {
//   const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
//   const [biometricEnabled, setBiometricEnabled] = useState(false);
//   const [pushNotifications, setPushNotifications] = useState(true);
//   const [emailNotifications, setEmailNotifications] = useState(true);
//   const [marketingEmails, setMarketingEmails] = useState(false);
//   const [showChangePassword, setShowChangePassword] = useState(false);
//   const [showDeleteAccount, setShowDeleteAccount] = useState(false);
//   const [currentPassword, setCurrentPassword] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [isChangingPassword, setIsChangingPassword] = useState(false);
//   const [isDeletingAccount, setIsDeletingAccount] = useState(false);
//   const [biometricAvailable, setBiometricAvailable] = useState(false);
//   const [biometricType, setBiometricType] = useState<string>("");

//   // Kiểm tra khả dụng của biometric
//   useEffect(() => {
//     checkBiometricAvailability();
//     loadSettings();
//   }, []);

//   const checkBiometricAvailability = async () => {
//     try {
//       const hasHardware = await LocalAuthentication.hasHardwareAsync();
//       const isEnrolled = await LocalAuthentication.isEnrolledAsync();
//       const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

//       setBiometricAvailable(hasHardware && isEnrolled);

//       if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
//         setBiometricType("Face ID");
//       } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
//         setBiometricType("Touch ID");
//       } else {
//         setBiometricType("Biometric");
//       }
//     } catch (error) {
//       console.error("Error checking biometric:", error);
//     }
//   };

//   const loadSettings = async () => {
//     try {
//       const savedBiometric = await AsyncStorage.getItem('@biometric_enabled');
//       if (savedBiometric !== null) {
//         setBiometricEnabled(JSON.parse(savedBiometric));
//       }

//       const saved2FA = await AsyncStorage.getItem('@two_factor_enabled');
//       if (saved2FA !== null) {
//         setTwoFactorEnabled(JSON.parse(saved2FA));
//       }
//     } catch (error) {
//       console.error("Error loading settings:", error);
//     }
//   };

//   const saveSetting = async (key: string, value: boolean) => {
//     try {
//       await AsyncStorage.setItem(key, JSON.stringify(value));
//     } catch (error) {
//       console.error("Error saving setting:", error);
//     }
//   };

//   const securitySettings: SecurityOption[] = [
//     {
//       id: "password",
//       icon: "lock-closed-outline",
//       title: "Change Password",
//       description: "Update your account password",
//       type: "modal",
//     },
//     {
//       id: "two-factor",
//       icon: "shield-checkmark-outline",
//       title: "Two-Factor Authentication",
//       description: "Add an extra layer of security",
//       type: "toggle",
//       value: twoFactorEnabled,
//     },
//     {
//       id: "biometric",
//       icon: "finger-print-outline",
//       title: biometricType || "Biometric Login",
//       description: biometricAvailable
//         ? `Use ${biometricType} for quick login`
//         : "Biometric authentication not available",
//       type: "toggle",
//       value: biometricEnabled && biometricAvailable,
//     },
//   ];

//   const privacySettings: SecurityOption[] = [
//     {
//       id: "push",
//       icon: "notifications-outline",
//       title: "Push Notifications",
//       description: "Receive push notifications",
//       type: "toggle",
//       value: pushNotifications,
//     },
//     {
//       id: "email",
//       icon: "mail-outline",
//       title: "Email Notifications",
//       description: "Receive order updates via email",
//       type: "toggle",
//       value: emailNotifications,
//     },
//     {
//       id: "marketing",
//       icon: "megaphone-outline",
//       title: "Marketing Emails",
//       description: "Receive promotional emails",
//       type: "toggle",
//       value: marketingEmails,
//     },
//   ];

//   const accountSettings = [
//     {
//       id: "activity",
//       icon: "time-outline",
//       title: "Account Activity",
//       description: "View recent login activity",
//       route: "/activity",
//     },
//     {
//       id: "data-download",
//       icon: "download-outline",
//       title: "Download Your Data",
//       description: "Get a copy of your data",
//       route: "/data-export",
//     },
//   ];

//   const handleToggle = async (id: string, value: boolean) => {
//     switch (id) {
//       case "two-factor":
//         if (value) {
//           // Hiển thị hướng dẫn bật 2FA
//           Alert.alert(
//             "Enable Two-Factor Authentication",
//             "To enable 2FA, we'll send a verification code to your email. Do you want to continue?",
//             [
//               { text: "Cancel", style: "cancel" },
//               {
//                 text: "Continue",
//                 onPress: async () => {
//                   setTwoFactorEnabled(true);
//                   await saveSetting('@two_factor_enabled', true);
//                   // Ở đây bạn có thể gọi API để gửi mã xác thực
//                   Alert.alert(
//                     "Verification Sent",
//                     "A verification code has been sent to your email. Please check your inbox."
//                   );
//                 }
//               }
//             ]
//           );
//         } else {
//           setTwoFactorEnabled(false);
//           await saveSetting('@two_factor_enabled', false);
//         }
//         break;

//       case "biometric":
//         if (value && biometricAvailable) {
//           // Yêu cầu xác thực biometric để bật
//           try {
//             const result = await LocalAuthentication.authenticateAsync({
//               promptMessage: `Authenticate to enable ${biometricType}`,
//               fallbackLabel: "Use passcode",
//             });

//             if (result.success) {
//               setBiometricEnabled(true);
//               await saveSetting('@biometric_enabled', true);
//               Alert.alert("Success", `${biometricType} enabled successfully`);
//             }
//           } catch (error) {
//             console.error("Biometric authentication error:", error);
//           }
//         } else {
//           setBiometricEnabled(false);
//           await saveSetting('@biometric_enabled', false);
//         }
//         break;

//       case "push":
//         setPushNotifications(value);
//         // Ở đây bạn có thể gọi API để cập nhật cài đặt notification
//         break;

//       case "email":
//         setEmailNotifications(value);
//         break;

//       case "marketing":
//         setMarketingEmails(value);
//     }
//   };

//   const handleNavigation = (route?: string) => {
//     if (route) {
//       router.push(route as any);
//     }
//   };

//   const handleChangePassword = async () => {
//     if (!currentPassword || !newPassword || !confirmPassword) {
//       Alert.alert("Error", "Please fill in all fields");
//       return;
//     }

//     if (newPassword !== confirmPassword) {
//       Alert.alert("Error", "New passwords do not match");
//       return;
//     }

//     if (newPassword.length < 6) {
//       Alert.alert("Error", "Password must be at least 6 characters");
//       return;
//     }

//     setIsChangingPassword(true);

//     try {
//       // Ở đây bạn sẽ gọi API để đổi mật khẩu
//       // const response = await api.changePassword(currentPassword, newPassword);

//       // Giả lập API call
//       await new Promise(resolve => setTimeout(resolve, 1500));

//       Alert.alert(
//         "Success",
//         "Password changed successfully",
//         [
//           {
//             text: "OK",
//             onPress: () => {
//               setShowChangePassword(false);
//               setCurrentPassword("");
//               setNewPassword("");
//               setConfirmPassword("");
//             }
//           }
//         ]
//       );
//     } catch (error) {
//       Alert.alert("Error", "Failed to change password. Please try again.");
//     } finally {
//       setIsChangingPassword(false);
//     }
//   };

//   const handleDeleteAccount = async () => {
//     Alert.alert(
//       "Delete Account",
//       "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.",
//       [
//         { text: "Cancel", style: "cancel" },
//         {
//           text: "Delete",
//           style: "destructive",
//           onPress: async () => {
//             setIsDeletingAccount(true);

//             try {
//               // Ở đây bạn sẽ gọi API để xóa tài khoản
//               // const response = await api.deleteAccount();

//               // Giả lập API call
//               await new Promise(resolve => setTimeout(resolve, 2000));

//               Alert.alert(
//                 "Account Deleted",
//                 "Your account has been successfully deleted.",
//                 [
//                   {
//                     text: "OK",
//                     onPress: () => {
//                       // Điều hướng về màn hình đăng nhập hoặc màn hình chính
//                       router.replace("/(tabs)");
//                     }
//                   }
//                 ]
//               );
//             } catch (error) {
//               Alert.alert("Error", "Failed to delete account. Please try again.");
//             } finally {
//               setIsDeletingAccount(false);
//               setShowDeleteAccount(false);
//             }
//           }
//         }
//       ]
//     );
//   };

//   const renderSettingItem = (setting: SecurityOption | any) => (
//     <TouchableOpacity
//       key={setting.id}
//       className="bg-surface rounded-2xl p-4 mb-3"
//       activeOpacity={setting.type === "toggle" || !setting.route ? 1 : 0.7}
//       onPress={() => {
//         if (setting.type === "modal" && setting.id === "password") {
//           setShowChangePassword(true);
//         } else if (setting.route) {
//           handleNavigation(setting.route);
//         }
//       }}
//       disabled={setting.id === "biometric" && !biometricAvailable}
//     >
//       <View className="flex-row items-center">
//         <View className={`${setting.id === "biometric" && !biometricAvailable ? "bg-gray-800/50" : "bg-primary/20"} rounded-full w-12 h-12 items-center justify-center mr-4`}>
//           <Ionicons
//             name={setting.icon as any}
//             size={24}
//             color={setting.id === "biometric" && !biometricAvailable ? "#666" : "#1DB954"}
//           />
//         </View>

//         <View className="flex-1">
//           <Text className={`${setting.id === "biometric" && !biometricAvailable ? "text-gray-500" : "text-text-primary"} font-bold text-base mb-1`}>
//             {setting.title}
//           </Text>
//           <Text className={`${setting.id === "biometric" && !biometricAvailable ? "text-gray-600" : "text-text-secondary"} text-sm`}>
//             {setting.description}
//           </Text>
//         </View>

//         {setting.type === "toggle" ? (
//           <Switch
//             value={setting.value}
//             onValueChange={(value) => handleToggle(setting.id, value)}
//             thumbColor="#FFFFFF"
//             trackColor={{ false: "#2A2A2A", true: "#1DB954" }}
//             disabled={setting.id === "biometric" && !biometricAvailable}
//           />
//         ) : (
//           <Ionicons name="chevron-forward" size={20} color="#666" />
//         )}
//       </View>
//     </TouchableOpacity>
//   );

//   return (
//     <SafeScreen>
//       {/* HEADER */}
//       <View className="px-6 pb-5 border-b border-surface flex-row items-center">
//         <TouchableOpacity onPress={() => router.back()} className="mr-4">
//           <Ionicons name="arrow-back" size={28} color="#fff" />
//         </TouchableOpacity>
//         <Text className="text-text-primary text-2xl font-bold">
//           Privacy & Security
//         </Text>
//       </View>

//       <ScrollView
//         className="flex-1"
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={{ paddingBottom: 80 }}
//       >
//         {/* SECURITY SECTION */}
//         <View className="px-6 pt-6">
//           <Text className="text-text-primary text-lg font-bold mb-4">
//             Security
//           </Text>
//           {securitySettings.map(renderSettingItem)}
//         </View>

//         {/* PRIVACY SECTION */}
//         <View className="px-6 pt-4">
//           <Text className="text-text-primary text-lg font-bold mb-4">
//             Privacy
//           </Text>
//           {privacySettings.map(renderSettingItem)}
//         </View>

//         {/* ACCOUNT SECTION */}
//         <View className="px-6 pt-4">
//           <Text className="text-text-primary text-lg font-bold mb-4">
//             Account
//           </Text>
//           {accountSettings.map(renderSettingItem)}
//         </View>

//         {/* DELETE ACCOUNT BUTTON */}
//         <View className="px-6 pt-6">
//           <TouchableOpacity
//             className="bg-surface rounded-2xl p-4 border-2 border-red-500/20"
//             activeOpacity={0.7}
//             onPress={() => setShowDeleteAccount(true)}
//           >
//             <View className="flex-row items-center">
//               <View className="bg-red-500/20 rounded-full w-12 h-12 items-center justify-center mr-4">
//                 <Ionicons name="trash-outline" size={24} color="#EF4444" />
//               </View>
//               <View className="flex-1">
//                 <Text className="text-red-500 font-bold text-base mb-1">
//                   Delete Account
//                 </Text>
//                 <Text className="text-text-secondary text-sm">
//                   Permanently delete your account
//                 </Text>
//               </View>
//               <Ionicons name="chevron-forward" size={20} color="#EF4444" />
//             </View>
//           </TouchableOpacity>
//         </View>

//         {/* INFO ALERT */}
//         <View className="px-6 pt-6 pb-4">
//           <View className="bg-primary/10 rounded-2xl p-4 flex-row">
//             <Ionicons
//               name="information-circle-outline"
//               size={24}
//               color="#1DB954"
//             />
//             <Text className="text-text-secondary text-sm ml-3 flex-1">
//               We take your privacy seriously. Your data is encrypted and stored
//               securely. You can manage your privacy settings at any time.
//             </Text>
//           </View>
//         </View>
//       </ScrollView>

//       {/* CHANGE PASSWORD MODAL */}
//       <Modal
//         visible={showChangePassword}
//         transparent
//         animationType="slide"
//         onRequestClose={() => setShowChangePassword(false)}
//       >
//         <TouchableWithoutFeedback onPress={() => setShowChangePassword(false)}>
//           <View className="flex-1 justify-end bg-black/50">
//             <TouchableWithoutFeedback>
//               <View className="bg-gray-900 rounded-t-3xl p-6">
//                 <View className="flex-row justify-between items-center mb-6">
//                   <Text className="text-white text-xl font-bold">Change Password</Text>
//                   <TouchableOpacity onPress={() => setShowChangePassword(false)}>
//                     <Ionicons name="close" size={24} color="#fff" />
//                   </TouchableOpacity>
//                 </View>

//                 <View className="space-y-4 mb-6">
//                   <View>
//                     <Text className="text-text-secondary mb-2">Current Password</Text>
//                     <TextInput
//                       className="bg-surface rounded-xl px-4 py-3 text-white"
//                       placeholder="Enter current password"
//                       placeholderTextColor="#666"
//                       secureTextEntry
//                       value={currentPassword}
//                       onChangeText={setCurrentPassword}
//                     />
//                   </View>

//                   <View>
//                     <Text className="text-text-secondary mb-2">New Password</Text>
//                     <TextInput
//                       className="bg-surface rounded-xl px-4 py-3 text-white"
//                       placeholder="Enter new password"
//                       placeholderTextColor="#666"
//                       secureTextEntry
//                       value={newPassword}
//                       onChangeText={setNewPassword}
//                     />
//                   </View>

//                   <View>
//                     <Text className="text-text-secondary mb-2">Confirm New Password</Text>
//                     <TextInput
//                       className="bg-surface rounded-xl px-4 py-3 text-white"
//                       placeholder="Confirm new password"
//                       placeholderTextColor="#666"
//                       secureTextEntry
//                       value={confirmPassword}
//                       onChangeText={setConfirmPassword}
//                     />
//                   </View>
//                 </View>

//                 <View className="flex-row gap-4">
//                   <TouchableOpacity
//                     onPress={() => setShowChangePassword(false)}
//                     className="flex-1 py-3 rounded-xl bg-surface items-center"
//                   >
//                     <Text className="text-text-secondary">Cancel</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity
//                     onPress={handleChangePassword}
//                     disabled={isChangingPassword}
//                     className="flex-1 py-3 rounded-xl bg-primary items-center flex-row justify-center"
//                   >
//                     {isChangingPassword ? (
//                       <ActivityIndicator color="#000" />
//                     ) : (
//                       <Text className="text-black font-bold">Change Password</Text>
//                     )}
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             </TouchableWithoutFeedback>
//           </View>
//         </TouchableWithoutFeedback>
//       </Modal>

//       {/* DELETE ACCOUNT MODAL */}
//       <Modal
//         visible={showDeleteAccount}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setShowDeleteAccount(false)}
//       >
//         <View className="flex-1 justify-center items-center bg-black/70 p-6">
//           <View className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm">
//             <View className="items-center mb-6">
//               <View className="bg-red-500/20 rounded-full w-16 h-16 items-center justify-center mb-4">
//                 <Ionicons name="trash-outline" size={32} color="#EF4444" />
//               </View>
//               <Text className="text-white text-xl font-bold text-center mb-2">
//                 Delete Account
//               </Text>
//               <Text className="text-text-secondary text-center text-sm">
//                 This action cannot be undone. All your data will be permanently removed.
//               </Text>
//             </View>

//             <View className="space-y-3 mb-6">
//               <Text className="text-text-secondary text-sm">
//                 • All your personal information will be deleted
//               </Text>
//               <Text className="text-text-secondary text-sm">
//                 • Your order history will be removed
//               </Text>
//               <Text className="text-text-secondary text-sm">
//                 • You will lose access to all premium features
//               </Text>
//             </View>

//             <View className="flex-row gap-4">
//               <TouchableOpacity
//                 onPress={() => setShowDeleteAccount(false)}
//                 className="flex-1 py-3 rounded-xl bg-surface items-center"
//               >
//                 <Text className="text-text-secondary">Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 onPress={handleDeleteAccount}
//                 disabled={isDeletingAccount}
//                 className="flex-1 py-3 rounded-xl bg-red-600 items-center flex-row justify-center"
//               >
//                 {isDeletingAccount ? (
//                   <ActivityIndicator color="#fff" />
//                 ) : (
//                   <Text className="text-white font-bold">Delete Account</Text>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </SafeScreen>
//   );
// }

// export default PrivacyAndSecurityScreen;

import SafeScreen from "@/components/SafeScreen";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SecurityOption = {
  id: string;
  icon: string;
  title: string;
  description: string;
  type: "navigation" | "toggle" | "modal";
  value?: boolean;
  route?: string;
};

function PrivacyAndSecurityScreen() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [isChangingPasscode, setIsChangingPasscode] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<"current" | "new" | "confirm">("current");

  // Kiểm tra khả dụng của biometric
  useEffect(() => {
    checkBiometricAvailability();
    loadSettings();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setBiometricAvailable(hasHardware && isEnrolled);

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Touch ID");
      } else {
        setBiometricType("Biometric");
      }
    } catch (error) {
      console.error("Error checking biometric:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedBiometric = await AsyncStorage.getItem('@biometric_enabled');
      if (savedBiometric !== null) {
        setBiometricEnabled(JSON.parse(savedBiometric));
      }

      const saved2FA = await AsyncStorage.getItem('@two_factor_enabled');
      if (saved2FA !== null) {
        setTwoFactorEnabled(JSON.parse(saved2FA));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error saving setting:", error);
    }
  };

  const securitySettings: SecurityOption[] = [
    {
      id: "passcode",
      icon: "keypad-outline",
      title: "Change Passcode",
      description: "Update your 6-digit security code",
      type: "modal",
    },
    {
      id: "two-factor",
      icon: "shield-checkmark-outline",
      title: "Two-Factor Authentication",
      description: "Add an extra layer of security",
      type: "toggle",
      value: twoFactorEnabled,
    },
    {
      id: "biometric",
      icon: "finger-print-outline",
      title: biometricType || "Biometric Login",
      description: biometricAvailable
        ? `Use ${biometricType} for quick login`
        : "Biometric authentication not available",
      type: "toggle",
      value: biometricEnabled && biometricAvailable,
    },
  ];

  const privacySettings: SecurityOption[] = [
    {
      id: "push",
      icon: "notifications-outline",
      title: "Push Notifications",
      description: "Receive push notifications",
      type: "toggle",
      value: pushNotifications,
    },
    {
      id: "email",
      icon: "mail-outline",
      title: "Email Notifications",
      description: "Receive order updates via email",
      type: "toggle",
      value: emailNotifications,
    },
    {
      id: "marketing",
      icon: "megaphone-outline",
      title: "Marketing Emails",
      description: "Receive promotional emails",
      type: "toggle",
      value: marketingEmails,
    },
  ];

  const accountSettings = [
    {
      id: "activity",
      icon: "time-outline",
      title: "Account Activity",
      description: "View recent login activity",
      route: "/activity",
    },
    {
      id: "data-download",
      icon: "download-outline",
      title: "Download Your Data",
      description: "Get a copy of your data",
      route: "/data-export",
    },
  ];

  const handleToggle = async (id: string, value: boolean) => {
    switch (id) {
      case "two-factor":
        if (value) {
          Alert.alert(
            "Enable Two-Factor Authentication",
            "To enable 2FA, we'll send a verification code to your email. Do you want to continue?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue",
                onPress: async () => {
                  setTwoFactorEnabled(true);
                  await saveSetting('@two_factor_enabled', true);
                  Alert.alert(
                    "Verification Sent",
                    "A verification code has been sent to your email. Please check your inbox."
                  );
                }
              }
            ]
          );
        } else {
          setTwoFactorEnabled(false);
          await saveSetting('@two_factor_enabled', false);
        }
        break;

      case "biometric":
        if (value && biometricAvailable) {
          try {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: `Authenticate to enable ${biometricType}`,
              fallbackLabel: "Use passcode",
            });

            if (result.success) {
              setBiometricEnabled(true);
              await saveSetting('@biometric_enabled', true);
              Alert.alert("Success", `${biometricType} enabled successfully`);
            }
          } catch (error) {
            console.error("Biometric authentication error:", error);
          }
        } else {
          setBiometricEnabled(false);
          await saveSetting('@biometric_enabled', false);
        }
        break;

      case "push":
        setPushNotifications(value);
        break;

      case "email":
        setEmailNotifications(value);
        break;

      case "marketing":
        setMarketingEmails(value);
    }
  };

  const handleNavigation = (route?: string) => {
    if (route) {
      router.push(route as any);
    }
  };

  const handlePasscodeInput = (value: string, setter: (val: string) => void) => {
    // Chỉ cho phép nhập số và tối đa 6 ký tự
    if (/^\d*$/.test(value) && value.length <= 6) {
      setter(value);
    }
  };

  const handleChangePasscode = async () => {
    if (!currentPasscode || !newPasscode || !confirmPasscode) {
      Alert.alert("Error", "Please fill in all passcode fields");
      return;
    }

    if (currentPasscode.length !== 6) {
      Alert.alert("Error", "Current passcode must be 6 digits");
      return;
    }

    if (newPasscode.length !== 6) {
      Alert.alert("Error", "New passcode must be 6 digits");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      Alert.alert("Error", "New passcodes do not match");
      return;
    }

    if (newPasscode === currentPasscode) {
      Alert.alert("Error", "New passcode must be different from current passcode");
      return;
    }

    setIsChangingPasscode(true);

    try {
      // Giả lập API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        "Success",
        "Passcode changed successfully",
        [
          {
            text: "OK",
            onPress: () => {
              setShowChangePasscode(false);
              setCurrentPasscode("");
              setNewPasscode("");
              setConfirmPasscode("");
              setCurrentStep("current");
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to change passcode. Please try again.");
    } finally {
      setIsChangingPasscode(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);

            try {
              await new Promise(resolve => setTimeout(resolve, 2000));

              Alert.alert(
                "Account Deleted",
                "Your account has been successfully deleted.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/(tabs)");
                    }
                  }
                ]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to delete account. Please try again.");
            } finally {
              setIsDeletingAccount(false);
              setShowDeleteAccount(false);
            }
          }
        }
      ]
    );
  };

  const renderPasscodeInput = (value: string, label: string, isActive: boolean) => (
    <View className="mb-4">
      <Text className="text-gray-300 mb-3 text-sm font-medium">{label}</Text>
      <View className="flex-row justify-between">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            className="w-14 h-16 rounded-xl items-center justify-center"
            style={{
              backgroundColor: isActive ? "#1DB95420" : "#1a1a1a",
              borderWidth: 2,
              borderColor: value.length > index ? "#1DB954" : isActive ? "#1DB95440" : "#333333"
            }}
          >
            <Text className="text-white text-2xl font-bold">
              {value[index] ? "•" : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Tìm hàm renderKeypad và sửa như sau:
  const renderKeypad = () => {
    const getCurrentValue = () => {
      switch (currentStep) {
        case "current": return currentPasscode;
        case "new": return newPasscode;
        case "confirm": return confirmPasscode;
      }
    };

    const getCurrentSetter = () => {
      switch (currentStep) {
        case "current": return setCurrentPasscode;
        case "new": return setNewPasscode;
        case "confirm": return setConfirmPasscode;
      }
    };

    const handleNumberPress = (num: number) => {
      const currentValue = getCurrentValue();
      const setter = getCurrentSetter();

      if (currentValue.length < 6) {
        handlePasscodeInput(currentValue + num, setter);

        // Tự động chuyển step khi đủ 6 số
        if (currentValue.length === 5) {
          setTimeout(() => {
            if (currentStep === "current") {
              setCurrentStep("new");
            } else if (currentStep === "new") {
              setCurrentStep("confirm");
            }
          }, 100);
        }
      }
    };

    const handleBackspace = () => {
      const currentValue = getCurrentValue();
      const setter = getCurrentSetter();

      if (currentValue.length > 0) {
        handlePasscodeInput(currentValue.slice(0, -1), setter);
      }
    };

    const renderKeypadButton = (content: string | number, onPress: () => void, isNumber = true, key: string) => (
      <TouchableOpacity
        key={key} // THÊM KEY PROP Ở ĐÂY
        onPress={onPress}
        className="w-20 h-20 rounded-full items-center justify-center"
        style={{
          backgroundColor: isNumber ? "#1a1a1a" : "transparent"
        }}
        activeOpacity={0.7}
      >
        {typeof content === 'number' ? (
          <Text className="text-white text-2xl font-semibold">{content}</Text>
        ) : (
          <Ionicons name={content as any} size={28} color="#fff" />
        )}
      </TouchableOpacity>
    );

    return (
      <View className="mt-6">
        <View className="flex-row justify-around mb-4">
          {[1, 2, 3].map((num) => renderKeypadButton(num, () => handleNumberPress(num), true, `num-${num}`))}
        </View>
        <View className="flex-row justify-around mb-4">
          {[4, 5, 6].map((num) => renderKeypadButton(num, () => handleNumberPress(num), true, `num-${num}`))}
        </View>
        <View className="flex-row justify-around mb-4">
          {[7, 8, 9].map((num) => renderKeypadButton(num, () => handleNumberPress(num), true, `num-${num}`))}
        </View>
        <View className="flex-row justify-around">
          <View className="w-20 h-20" />
          {renderKeypadButton(0, () => handleNumberPress(0), true, "num-0")}
          {renderKeypadButton("backspace-outline", handleBackspace, false, "backspace")}
        </View>
      </View>
    );
  };
  const renderSettingItem = (setting: SecurityOption | any) => (
    <TouchableOpacity
      key={setting.id}
      className="bg-[#1a1a1a] rounded-2xl p-4 mb-3"
      activeOpacity={setting.type === "toggle" || !setting.route ? 1 : 0.7}
      onPress={() => {
        if (setting.type === "modal" && setting.id === "passcode") {
          setShowChangePasscode(true);
        } else if (setting.route) {
          handleNavigation(setting.route);
        }
      }}
      disabled={setting.id === "biometric" && !biometricAvailable}
    >
      <View className="flex-row items-center">
        <View className={`${setting.id === "biometric" && !biometricAvailable ? "bg-gray-800/50" : "bg-[#1DB95420]"} rounded-full w-12 h-12 items-center justify-center mr-4`}>
          <Ionicons
            name={setting.icon as any}
            size={24}
            color={setting.id === "biometric" && !biometricAvailable ? "#666" : "#1DB954"}
          />
        </View>

        <View className="flex-1">
          <Text className={`${setting.id === "biometric" && !biometricAvailable ? "text-gray-500" : "text-white"} font-bold text-base mb-1`}>
            {setting.title}
          </Text>
          <Text className={`${setting.id === "biometric" && !biometricAvailable ? "text-gray-600" : "text-gray-400"} text-sm`}>
            {setting.description}
          </Text>
        </View>

        {setting.type === "toggle" ? (
          <Switch
            value={setting.value}
            onValueChange={(value) => handleToggle(setting.id, value)}
            thumbColor="#FFFFFF"
            trackColor={{ false: "#333333", true: "#1DB954" }}
            ios_backgroundColor="#333333"
            disabled={setting.id === "biometric" && !biometricAvailable}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#666" />
        )}
      </View>
    </TouchableOpacity>
  );

  const getCurrentStepTitle = () => {
    switch (currentStep) {
      case "current": return "Enter Current Passcode";
      case "new": return "Enter New Passcode";
      case "confirm": return "Confirm New Passcode";
    }
  };

  const getCurrentStepDescription = () => {
    switch (currentStep) {
      case "current": return "Enter your current 6-digit passcode";
      case "new": return "Create a new 6-digit passcode";
      case "confirm": return "Re-enter your new passcode";
    }
  };

  return (
    <SafeScreen>
      {/* HEADER */}
      <View className="px-6 pb-5 border-b border-[#2A2A2A] flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">
          Privacy & Security
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* SECURITY SECTION */}
        <View className="px-6 pt-6">
          <Text className="text-white text-lg font-bold mb-4">
            Security
          </Text>
          {securitySettings.map(renderSettingItem)}
        </View>

        {/* PRIVACY SECTION */}
        <View className="px-6 pt-4">
          <Text className="text-white text-lg font-bold mb-4">
            Privacy
          </Text>
          {privacySettings.map(renderSettingItem)}
        </View>

        {/* ACCOUNT SECTION */}
        <View className="px-6 pt-4">
          <Text className="text-white text-lg font-bold mb-4">
            Account
          </Text>
          {accountSettings.map(renderSettingItem)}
        </View>

        {/* DELETE ACCOUNT BUTTON */}
        <View className="px-6 pt-6">
          <TouchableOpacity
            className="bg-[#1a1a1a] rounded-2xl p-4 border-2 border-red-500/20"
            activeOpacity={0.7}
            onPress={() => setShowDeleteAccount(true)}
          >
            <View className="flex-row items-center">
              <View className="bg-red-500/20 rounded-full w-12 h-12 items-center justify-center mr-4">
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className="text-red-500 font-bold text-base mb-1">
                  Delete Account
                </Text>
                <Text className="text-gray-400 text-sm">
                  Permanently delete your account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EF4444" />
            </View>
          </TouchableOpacity>
        </View>

        {/* INFO ALERT */}
        <View className="px-6 pt-6 pb-4">
          <View className="bg-[#1DB95410] rounded-2xl p-4 border border-[#1DB95420]">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#1DB954"
              />
              <Text className="text-gray-400 text-sm ml-3 flex-1">
                We take your privacy seriously. Your data is encrypted and stored
                securely. You can manage your privacy settings at any time.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CHANGE PASSCODE BOTTOM SHEET - UPDATED COLORS */}
      <Modal
        visible={showChangePasscode}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowChangePasscode(false);
          setCurrentPasscode("");
          setNewPasscode("");
          setConfirmPasscode("");
          setCurrentStep("current");
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowChangePasscode(false);
          setCurrentPasscode("");
          setNewPasscode("");
          setConfirmPasscode("");
          setCurrentStep("current");
        }}>
          <View className="flex-1 justify-end bg-black/80">
            <TouchableWithoutFeedback>
              <View className="bg-[#0f0f0f] rounded-t-3xl border-t border-[#2A2A2A] shadow-2xl" style={{ maxHeight: '85%' }}>
                {/* Handle Bar */}
                <View className="items-center pt-4 pb-3">
                  <View className="w-16 h-1.5 bg-[#333333] rounded-full" />
                </View>

                {/* Header */}
                <View className="px-6 py-4 border-b border-[#2A2A2A]">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-white text-2xl font-bold">Change Passcode</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowChangePasscode(false);
                        setCurrentPasscode("");
                        setNewPasscode("");
                        setConfirmPasscode("");
                        setCurrentStep("current");
                      }}
                      className="p-2"
                    >
                      <Ionicons name="close" size={24} color="#888" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-gray-300 text-base mb-1">
                        {getCurrentStepTitle()}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {getCurrentStepDescription()}
                      </Text>
                    </View>
                    <View className="flex-row space-x-1">
                      <View className={`w-3 h-3 rounded-full ${currentStep === "current" ? "bg-[#1DB954]" : "bg-[#333333]"}`} />
                      <View className={`w-3 h-3 rounded-full ${currentStep === "new" ? "bg-[#1DB954]" : "bg-[#333333]"}`} />
                      <View className={`w-3 h-3 rounded-full ${currentStep === "confirm" ? "bg-[#1DB954]" : "bg-[#333333]"}`} />
                    </View>
                  </View>
                </View>

                {/* Content */}
                <ScrollView
                  className="px-6 py-6"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Current Passcode */}
                  {currentStep === "current" && renderPasscodeInput(currentPasscode, "Current Passcode", true)}
                  {currentStep === "new" && renderPasscodeInput(newPasscode, "New Passcode", true)}
                  {currentStep === "confirm" && renderPasscodeInput(confirmPasscode, "Confirm Passcode", true)}

                  {/* Progress Steps */}
                  <View className="flex-row justify-center items-center my-6">
                    {["current", "new", "confirm"].map((step, index) => (
                      <View key={step} className="flex-row items-center">
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${currentStep === step ? "bg-[#1DB954]" :
                            (step === "new" && currentPasscode.length === 6) ||
                              (step === "confirm" && newPasscode.length === 6) ? "bg-[#1DB954]" : "bg-[#333333]"
                            }`}
                        >
                          <Ionicons
                            name={
                              (step === "current" && currentPasscode.length === 6) ||
                                (step === "new" && newPasscode.length === 6) ||
                                (step === "confirm" && confirmPasscode.length === 6) ?
                                "checkmark" : step === "current" ? "lock-closed" :
                                  step === "new" ? "key" : "checkmark-circle"
                            }
                            size={16}
                            color={currentStep === step ? "#000" : "#888"}
                          />
                        </View>
                        {index < 2 && (
                          <View
                            className={`w-8 h-0.5 mx-1 ${(step === "current" && currentPasscode.length === 6) ||
                              (step === "new" && newPasscode.length === 6) ? "bg-[#1DB954]" : "bg-[#333333]"
                              }`}
                          />
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Keypad */}
                  <View className="bg-[#141414] rounded-2xl p-4 border border-[#2A2A2A]">
                    {renderKeypad()}
                  </View>

                  {/* Submit Button */}
                  {confirmPasscode.length === 6 && (
                    <View className="mt-8 mb-4 space-y-3">
                      <TouchableOpacity
                        onPress={handleChangePasscode}
                        disabled={isChangingPasscode}
                        className="py-4 rounded-xl bg-[#1DB954] items-center flex-row justify-center shadow-lg"
                        activeOpacity={0.8}
                      >
                        {isChangingPasscode ? (
                          <ActivityIndicator color="#000" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={20} color="#000" />
                            <Text className="text-black font-bold text-lg ml-2">Change Passcode</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setShowChangePasscode(false);
                          setCurrentPasscode("");
                          setNewPasscode("");
                          setConfirmPasscode("");
                          setCurrentStep("current");
                        }}
                        className="py-4 rounded-xl bg-[#1a1a1a] border border-[#333333] items-center"
                        activeOpacity={0.8}
                      >
                        <Text className="text-gray-400 font-semibold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Instructions */}
                  {currentStep !== "confirm" && (
                    <View className="mt-6 p-4 bg-[#1a1a1a] rounded-xl border border-[#2A2A2A]">
                      <Text className="text-gray-400 text-sm text-center">
                        Enter a 6-digit numeric passcode. Make sure it's easy to remember but hard to guess.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* DELETE ACCOUNT MODAL */}
      <Modal
        visible={showDeleteAccount}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteAccount(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-6">
          <View className="bg-[#0f0f0f] rounded-3xl p-6 w-full max-w-sm border border-[#2A2A2A]">
            <View className="items-center mb-6">
              <View className="bg-red-500/20 rounded-full w-20 h-20 items-center justify-center mb-4 border border-red-500/30">
                <Ionicons name="trash-outline" size={36} color="#EF4444" />
              </View>
              <Text className="text-white text-2xl font-bold text-center mb-2">
                Delete Account
              </Text>
              <Text className="text-gray-400 text-center text-sm">
                This action cannot be undone. All your data will be permanently removed.
              </Text>
            </View>

            <View className="space-y-3 mb-6 bg-[#1a1a1a] rounded-xl p-4 border border-[#2A2A2A]">
              <View className="flex-row items-start">
                <Ionicons name="warning-outline" size={16} color="#EF4444" className="mt-1 mr-2" />
                <Text className="text-gray-300 text-sm flex-1">
                  • All your personal information will be deleted
                </Text>
              </View>
              <View className="flex-row items-start">
                <Ionicons name="warning-outline" size={16} color="#EF4444" className="mt-1 mr-2" />
                <Text className="text-gray-300 text-sm flex-1">
                  • Your order history will be removed
                </Text>
              </View>
              <View className="flex-row items-start">
                <Ionicons name="warning-outline" size={16} color="#EF4444" className="mt-1 mr-2" />
                <Text className="text-gray-300 text-sm flex-1">
                  • You will lose access to all premium features
                </Text>
              </View>
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setShowDeleteAccount(false)}
                className="flex-1 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] items-center"
                activeOpacity={0.8}
              >
                <Text className="text-gray-400 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 py-3 rounded-xl bg-red-600 items-center flex-row justify-center shadow-lg"
                activeOpacity={0.8}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color="#fff" />
                    <Text className="text-white font-bold ml-2">Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

export default PrivacyAndSecurityScreen;