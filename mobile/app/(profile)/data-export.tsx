import SafeScreen from "@/components/SafeScreen";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type DataType = {
    id: string;
    name: string;
    description: string;
    size: string;
    included: boolean;
};

export default function DataExportScreen() {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([
        "profile",
        "orders",
        "activity"
    ]);
    const [exporting, setExporting] = useState(false);
    const [format, setFormat] = useState<"json" | "csv">("json");

    const dataTypes: DataType[] = [
        {
            id: "profile",
            name: "Profile Information",
            description: "Name, email, phone number, profile picture",
            size: "2 KB",
            included: true
        },
        {
            id: "orders",
            name: "Order History",
            description: "All your past purchases and transactions",
            size: "15 KB",
            included: true
        },
        {
            id: "activity",
            name: "Account Activity",
            description: "Login history and security events",
            size: "8 KB",
            included: true
        },
        {
            id: "preferences",
            name: "Preferences",
            description: "App settings and customization",
            size: "1 KB",
            included: false
        },
        {
            id: "reviews",
            name: "Product Reviews",
            description: "All reviews you've written",
            size: "5 KB",
            included: false
        },
        {
            id: "wishlist",
            name: "Wishlist",
            description: "Saved items and favorites",
            size: "3 KB",
            included: false
        }
    ];

    const toggleDataType = (id: string) => {
        if (selectedTypes.includes(id)) {
            setSelectedTypes(selectedTypes.filter(type => type !== id));
        } else {
            setSelectedTypes([...selectedTypes, id]);
        }
    };

    const selectAll = () => {
        if (selectedTypes.length === dataTypes.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(dataTypes.map(type => type.id));
        }
    };

    const simulateDataExport = async () => {
        const mockData = {
            exportedAt: new Date().toISOString(),
            format: format,
            dataTypes: selectedTypes,
            profile: {
                name: "John Doe",
                email: "john@example.com",
                phone: "+1234567890",
                joinedDate: "2023-01-15"
            },
            orders: [
                {
                    id: "ORD-001",
                    date: "2023-12-15",
                    total: 99.99,
                    status: "delivered"
                },
                {
                    id: "ORD-002",
                    date: "2023-12-20",
                    total: 149.99,
                    status: "processing"
                }
            ],
            activity: [
                {
                    date: "2023-12-25",
                    type: "login",
                    device: "iPhone 15 Pro"
                }
            ]
        };

        return JSON.stringify(mockData, null, 2);
    };

    const handleExport = async () => {
        if (selectedTypes.length === 0) {
            Alert.alert("No Data Selected", "Please select at least one data type to export.");
            return;
        }

        setExporting(true);

        try {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            const data = await simulateDataExport();
            const fileName = `data_export_${Date.now()}.${format}`;
            const fileUri = FileSystem.Directory + fileName;

            // await FileSystem.writeAsStringAsync(fileUri, data, {
            //     encoding: FileSystem.EncodingType.UTF8
            // });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: format === 'json' ? 'application/json' : 'text/csv',
                    dialogTitle: 'Download Your Data'
                });
            } else {
                Alert.alert(
                    "Export Complete",
                    `Your data has been exported. File saved as: ${fileName}`,
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                // Could navigate to file location
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error("Export error:", error);
            Alert.alert("Export Failed", "There was an error exporting your data. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    return (
        <SafeScreen>
            {/* HEADER */}
            <View className="px-6 pb-5 border-b border-surface flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text className="text-text-primary text-2xl font-bold">
                    Download Your Data
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
            >
                {/* FORMAT SELECTION */}
                <View className="px-6 pt-6">
                    <Text className="text-text-primary text-lg font-bold mb-4">
                        Export Format
                    </Text>

                    <View className="flex-row mb-6">
                        <TouchableOpacity
                            onPress={() => setFormat("json")}
                            className={`flex-1 py-3 rounded-l-2xl items-center ${format === "json" ? "bg-primary" : "bg-surface"}`}
                        >
                            <Text className={`font-bold ${format === "json" ? "text-black" : "text-text-secondary"}`}>
                                JSON
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFormat("csv")}
                            className={`flex-1 py-3 rounded-r-2xl items-center ${format === "csv" ? "bg-primary" : "bg-surface"}`}
                        >
                            <Text className={`font-bold ${format === "csv" ? "text-black" : "text-text-secondary"}`}>
                                CSV
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* DATA TYPES */}
                <View className="px-6 pt-2">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-text-primary text-lg font-bold">
                            Select Data Types
                        </Text>
                        <TouchableOpacity onPress={selectAll}>
                            <Text className="text-primary text-sm font-medium">
                                {selectedTypes.length === dataTypes.length ? "Deselect All" : "Select All"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {dataTypes.map((dataType) => (
                        <TouchableOpacity
                            key={dataType.id}
                            onPress={() => toggleDataType(dataType.id)}
                            className="bg-surface rounded-2xl p-4 mb-3"
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center">
                                <View className={`rounded-full w-6 h-6 items-center justify-center mr-4 border-2 ${selectedTypes.includes(dataType.id) ? "bg-primary border-primary" : "border-gray-600"}`}>
                                    {selectedTypes.includes(dataType.id) && (
                                        <Ionicons name="checkmark" size={16} color="#000" />
                                    )}
                                </View>

                                <View className="flex-1">
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-text-primary font-bold text-base">
                                            {dataType.name}
                                        </Text>
                                        <Text className="text-text-secondary text-sm">
                                            {dataType.size}
                                        </Text>
                                    </View>
                                    <Text className="text-text-secondary text-sm">
                                        {dataType.description}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ESTIMATED SIZE */}
                <View className="px-6 pt-4">
                    <View className="bg-surface rounded-2xl p-4">
                        <View className="flex-row justify-between items-center">
                            <View>
                                <Text className="text-text-primary font-bold text-base mb-1">
                                    Estimated Size
                                </Text>
                                <Text className="text-text-secondary text-sm">
                                    {selectedTypes.length} of {dataTypes.length} items selected
                                </Text>
                            </View>
                            <Text className="text-primary text-lg font-bold">
                                ~25 KB
                            </Text>
                        </View>
                    </View>
                </View>

                {/* EXPORT BUTTON */}
                <View className="px-6 pt-6">
                    <TouchableOpacity
                        onPress={handleExport}
                        disabled={exporting || selectedTypes.length === 0}
                        className={`rounded-2xl p-4 items-center ${selectedTypes.length === 0 ? "bg-gray-800" : "bg-primary"}`}
                        activeOpacity={0.7}
                    >
                        {exporting ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text className="text-black font-bold text-lg">
                                Export Data
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* INFO */}
                <View className="px-6 pt-6 pb-4">
                    <View className="bg-primary/10 rounded-2xl p-4">
                        <View className="flex-row mb-3">
                            <Ionicons
                                name="information-circle-outline"
                                size={24}
                                color="#1DB954"
                            />
                            <Text className="text-text-primary font-bold text-base ml-3">
                                Important Information
                            </Text>
                        </View>

                        <View className="space-y-2">
                            <Text className="text-text-secondary text-sm">
                                • Your data will be exported in {format.toUpperCase()} format
                            </Text>
                            <Text className="text-text-secondary text-sm">
                                • The export may take a few moments to prepare
                            </Text>
                            <Text className="text-text-secondary text-sm">
                                • You'll receive the file via your device's sharing options
                            </Text>
                            <Text className="text-text-secondary text-sm">
                                • Exported data is for your personal use only
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeScreen>
    );
}