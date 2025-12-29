// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Image,
//   Button,
// } from "react-native";
// import SafeScreen from "@/components/SafeScreen";
// import { Ionicons } from "@expo/vector-icons";
// import ProductsGrid from "@/components/ProductsGrid";
// import useProducts from "@/hooks/useProducts";
// import { useState, useMemo } from "react";
// import * as Sentry from "@sentry/react-native";

// const CATEGORIES = [
//   { name: "All", icon: "grid-outline" as const },
//   { name: "Electronics", image: require("@/assets/images/electronics.png") },
//   { name: "Fashion", image: require("@/assets/images/fashion.png") },
//   { name: "Sports", image: require("@/assets/images/sports.png") },
//   { name: "Accessories", image: require("@/assets/images/books.png") },
// ];

// const ShopScreen = () => {
//   const [searchQuery, setSearchQuery] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("All");

//   const { data: products, isLoading, isError } = useProducts();
//   console.log(products);
//   const filteredProducts = useMemo(() => {
//     if (!products) return [];

//     let filtered = products;

//     // filtering by category
//     if (selectedCategory !== "All") {
//       filtered = filtered.filter(
//         (product) => product.category === selectedCategory
//       );
//     }

//     // filtering by searh query
//     if (searchQuery.trim()) {
//       filtered = filtered.filter((product) =>
//         product.name.toLowerCase().includes(searchQuery.toLowerCase())
//       );
//     }

//     return filtered;
//   }, [products, selectedCategory, searchQuery]);

//   return (
//     <SafeScreen>
//       <ScrollView
//         className="flex-1"
//         contentContainerStyle={{ paddingBottom: 100 }}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* HEADER */}
//         <View className="px-6 pb-4 pt-6">
//           <View className="flex-row items-center justify-between mb-6">
//             <View>
//               <Text className="text-text-primary text-3xl font-bold tracking-tight">
//                 Shop
//               </Text>
//               <Text className="text-text-secondary text-sm mt-1">
//                 Browse all products
//               </Text>
//             </View>

//             <TouchableOpacity
//               className="bg-surface/50 p-3 rounded-full"
//               activeOpacity={0.7}
//             >
//               <Ionicons name="options-outline" size={22} color={"#fff"} />
//             </TouchableOpacity>
//           </View>

//           {/* SEARCH BAR */}
//           <View className="bg-surface flex-row items-center px-5 py-4 rounded-2xl">
//             <Ionicons color={"#666"} size={22} name="search" />
//             <TextInput
//               placeholder="Search for products"
//               placeholderTextColor={"#666"}
//               className="flex-1 ml-3 text-base text-text-primary"
//               value={searchQuery}
//               onChangeText={setSearchQuery}
//             />
//           </View>
//         </View>

//         {/* CATEGORY FILTER */}
//         <View className="mb-6">
//           <ScrollView
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={{ paddingHorizontal: 20 }}
//           >
//             {CATEGORIES.map((category) => {
//               const isSelected = selectedCategory === category.name;
//               return (
//                 <TouchableOpacity
//                   key={category.name}
//                   onPress={() => setSelectedCategory(category.name)}
//                   className={`mr-3 rounded-2xl size-20 overflow-hidden items-center justify-center ${isSelected ? "bg-primary" : "bg-surface"}`}
//                 >
//                   {category.icon ? (
//                     <Ionicons
//                       name={category.icon}
//                       size={36}
//                       color={isSelected ? "#121212" : "#fff"}
//                     />
//                   ) : (
//                     <Image
//                       source={category.image}
//                       className="size-12"
//                       resizeMode="contain"
//                     />
//                   )}
//                 </TouchableOpacity>
//               );
//             })}
//           </ScrollView>
//         </View>

//         <View className="px-6 mb-6">
//           <View className="flex-row items-center justify-between mb-4">
//             <Text className="text-text-primary text-lg font-bold">
//               Products
//             </Text>
//             <Text className="text-text-secondary text-sm">
//               {filteredProducts.length} items
//             </Text>
//           </View>

//           {/* PRODUCTS GRID */}
//           <ProductsGrid
//             products={filteredProducts}
//             isLoading={isLoading}
//             isError={isError}
//           />
//         </View>
//       </ScrollView>
//     </SafeScreen>
//   );
// };

// export default ShopScreen;


import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import SafeScreen from "@/components/SafeScreen";
import { Ionicons } from "@expo/vector-icons";
import ProductsGrid from "@/components/ProductsGrid";
import useProducts from "@/hooks/useProducts";
import { useState, useMemo, useRef } from "react";
import * as Sentry from "@sentry/react-native";

const CATEGORIES = [
  { name: "All", icon: "grid-outline" as const },
  { name: "Electronics", image: require("@/assets/images/electronics.png") },
  { name: "Fashion", image: require("@/assets/images/fashion.png") },
  { name: "Sports", image: require("@/assets/images/sports.png") },
  { name: "Accessories", image: require("@/assets/images/books.png") },
];

const SORT_OPTIONS = [
  { id: "default", label: "Mặc định", icon: "swap-vertical" },
  { id: "price_asc", label: "Giá thấp đến cao", icon: "arrow-up" },
  { id: "price_desc", label: "Giá cao đến thấp", icon: "arrow-down" },
  { id: "name_asc", label: "Tên A-Z", icon: "text" },
  { id: "name_desc", label: "Tên Z-A", icon: "text" },
  { id: "newest", label: "Mới nhất", icon: "time" },
  { id: "popular", label: "Phổ biến", icon: "trending-up" },
];

const FILTER_OPTIONS = [
  { id: "all", label: "Tất cả sản phẩm" },
  { id: "in_stock", label: "Còn hàng", icon: "checkmark-circle" },
  { id: "sale", label: "Đang giảm giá", icon: "pricetag" },
  { id: "free_shipping", label: "Miễn phí vận chuyển", icon: "car" },
  { id: "high_rating", label: "Đánh giá cao (>4.0)", icon: "star" },
];

const ShopScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedSort, setSelectedSort] = useState("default");
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["all"]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [showPriceRangeModal, setShowPriceRangeModal] = useState(false);

  const optionsRef = useRef<View>(null);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });

  const { data: products, isLoading, isError } = useProducts();

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products;

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (product) => product.category === selectedCategory
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filters
    selectedFilters.forEach((filterId) => {
      switch (filterId) {
        case "in_stock":
          filtered = filtered.filter((p) => p.stock > 0);
          break;
          // case "sale":
          //   filtered = filtered.filter((p) => p.discount > 0);
          //   break;
          // case "free_shipping":
          //   filtered = filtered.filter((p) => p.freeShipping);
          break;
        case "high_rating":
          filtered = filtered.filter((p) => p.averageRating > 4.0);
          break;
      }
    });

    // Filter by price range
    filtered = filtered.filter(
      (p) => p.price >= priceRange.min && p.price <= priceRange.max
    );

    // Apply sorting
    filtered.sort((a, b) => {
      switch (selectedSort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        // case "popular":
        //   return b.sales - a.sales;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, selectedCategory, searchQuery, selectedSort, selectedFilters, priceRange]);

  const handleFilterToggle = (filterId: string) => {
    if (filterId === "all") {
      setSelectedFilters(["all"]);
    } else {
      setSelectedFilters((prev) => {
        const newFilters = prev.filter((f) => f !== "all");
        if (newFilters.includes(filterId)) {
          return newFilters.filter((f) => f !== filterId);
        } else {
          return [...newFilters, filterId];
        }
      });
    }
  };

  const handleOptionsPress = (event: any) => {
    optionsRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setOptionsPosition({
        x: pageX - 200,
        y: pageY + height + 10,
      });
      setShowOptions(true);
    });
  };

  const resetFilters = () => {
    setSelectedSort("default");
    setSelectedFilters(["all"]);
    setPriceRange({ min: 0, max: 1000 });
  };

  const getActiveFiltersCount = () => {
    return selectedFilters.filter(f => f !== "all").length +
      (selectedSort !== "default" ? 1 : 0) +
      (priceRange.min > 0 || priceRange.max < 1000 ? 1 : 0);
  };

  return (
    <SafeScreen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View className="px-6 pb-4 pt-6">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-text-primary text-3xl font-bold tracking-tight">
                Shop
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                Browse all products
              </Text>
            </View>

            <TouchableOpacity
              ref={optionsRef}
              onPress={handleOptionsPress}
              className="bg-surface/50 p-3 rounded-full relative"
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={22} color={"#fff"} />
              {getActiveFiltersCount() > 0 && (
                <View className="absolute -top-1 -right-1 bg-primary rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-xs font-bold text-black">
                    {getActiveFiltersCount()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* SEARCH BAR */}
          <View className="bg-surface flex-row items-center px-5 py-4 rounded-2xl">
            <Ionicons color={"#666"} size={22} name="search" />
            <TextInput
              placeholder="Search for products"
              placeholderTextColor={"#666"}
              className="flex-1 ml-3 text-base text-text-primary"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* CATEGORY FILTER */}
        <View className="mb-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <TouchableOpacity
                  key={category.name}
                  onPress={() => setSelectedCategory(category.name)}
                  className={`mr-3 rounded-2xl size-20 overflow-hidden items-center justify-center ${isSelected ? "bg-primary" : "bg-surface"}`}
                >
                  {category.icon ? (
                    <Ionicons
                      name={category.icon}
                      size={36}
                      color={isSelected ? "#121212" : "#fff"}
                    />
                  ) : (
                    <Image
                      source={category.image}
                      className="size-12"
                      resizeMode="contain"
                    />
                  )}
                  {/* <Text className={`mt-2 text-xs font-medium ${isSelected ? "text-black" : "text-text-secondary"}`}>
                    {category.name}
                  </Text> */}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ACTIVE FILTERS BAR */}
        {getActiveFiltersCount() > 0 && (
          <View className="px-6 mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-2">
                {selectedSort !== "default" && (
                  <View className="bg-primary/20 px-3 py-2 rounded-full flex-row items-center">
                    <Text className="text-primary text-sm">
                      {SORT_OPTIONS.find(s => s.id === selectedSort)?.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSelectedSort("default")}
                      className="ml-2"
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                {selectedFilters
                  .filter(f => f !== "all")
                  .map(filterId => (
                    <View key={filterId} className="bg-primary/20 px-3 py-2 rounded-full flex-row items-center">
                      <Text className="text-primary text-sm">
                        {FILTER_OPTIONS.find(f => f.id === filterId)?.label}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleFilterToggle(filterId)}
                        className="ml-2"
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                {(priceRange.min > 0 || priceRange.max < 1000) && (
                  <View className="bg-primary/20 px-3 py-2 rounded-full flex-row items-center">
                    <Text className="text-primary text-sm">
                      ${priceRange.min} - ${priceRange.max}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPriceRange({ min: 0, max: 1000 })}
                      className="ml-2"
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={resetFilters}
                  className="px-3 py-2 rounded-full flex-row items-center bg-surface"
                >
                  <Text className="text-text-secondary text-sm">Xóa tất cả</Text>
                  <Ionicons name="close-circle" size={16} color="#666" className="ml-1" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}

        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-text-primary text-lg font-bold">
              Products
            </Text>
            <Text className="text-text-secondary text-sm">
              {filteredProducts.length} items
            </Text>
          </View>

          {/* PRODUCTS GRID */}
          <ProductsGrid
            products={filteredProducts}
            isLoading={isLoading}
            isError={isError}
          />
        </View>
      </ScrollView>

      {/* OPTIONS MODAL */}
      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowOptions(false)}>
          <View className="flex-1">
            <View
              style={[
                styles.optionsMenu,
                {
                  position: "absolute",
                  top: optionsPosition.y - 40,
                  left: optionsPosition.x - 7,
                },
              ]}
            >
              {/* SORT SECTION */}
              <View className="mb-4">
                <Text className="text-text-secondary text-xs font-medium mb-3">
                  SẮP XẾP THEO
                </Text>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => {
                      setSelectedSort(option.id);
                      setShowOptions(false);
                    }}
                    className="flex-row items-center justify-between py-3"
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={selectedSort === option.id ? "#fff" : "#666"}
                        className="mr-3"
                      />
                      <Text
                        className={`text-base ${selectedSort === option.id ? "text-white font-medium" : "text-text-secondary"}`}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {selectedSort === option.id && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* FILTERS SECTION */}
              <View className="mb-4 border-t border-gray-800 pt-4">
                <Text className="text-text-secondary text-xs font-medium mb-3">
                  LỌC THEO
                </Text>
                {FILTER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleFilterToggle(option.id)}
                    className="flex-row items-center justify-between py-3"
                  >
                    <View className="flex-row items-center">
                      {option.icon && (
                        <Ionicons
                          name={option.icon as any}
                          size={18}
                          color={selectedFilters.includes(option.id) ? "#fff" : "#666"}
                          className="mr-3"
                        />
                      )}
                      <Text
                        className={`text-base ${selectedFilters.includes(option.id) ? "text-white font-medium" : "text-text-secondary"}`}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {selectedFilters.includes(option.id) && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* PRICE RANGE */}
              <View className="border-t border-gray-800 pt-4">
                <TouchableOpacity
                  onPress={() => {
                    setShowOptions(false);
                    setShowPriceRangeModal(true);
                  }}
                  className="flex-row items-center justify-between py-3"
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="cash"
                      size={18}
                      color="#666"
                      className="mr-3"
                    />
                    <Text className="text-text-secondary text-base">
                      Khoảng giá
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-text-secondary text-sm mr-2">
                      ${priceRange.min} - ${priceRange.max}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#666" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* RESET BUTTON */}
              <TouchableOpacity
                onPress={() => {
                  resetFilters();
                  setShowOptions(false);
                }}
                className="mt-4 py-3 rounded-lg bg-surface items-center"
              >
                <Text className="text-text-secondary font-medium">
                  Đặt lại bộ lọc
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* PRICE RANGE MODAL */}
      <Modal
        visible={showPriceRangeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPriceRangeModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-gray-900 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Khoảng giá</Text>
              <TouchableOpacity onPress={() => setShowPriceRangeModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-between mb-8">
              <View className="flex-1 mr-2">
                <Text className="text-text-secondary mb-2">Tối thiểu</Text>
                <View className="bg-surface rounded-xl px-4 py-3">
                  <Text className="text-white">${priceRange.min}</Text>
                </View>
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-text-secondary mb-2">Tối đa</Text>
                <View className="bg-surface rounded-xl px-4 py-3">
                  <Text className="text-white">${priceRange.max}</Text>
                </View>
              </View>
            </View>

            {/* Custom Slider Component would go here */}
            <View className="h-1 bg-surface rounded-full mb-8">
              <View className="flex-row justify-between">
                <View className="w-6 h-6 bg-primary rounded-full -mt-2" />
                <View className="w-6 h-6 bg-primary rounded-full -mt-2" />
              </View>
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setPriceRange({ min: 0, max: 1000 })}
                className="flex-1 py-3 rounded-xl bg-surface items-center"
              >
                <Text className="text-text-secondary">Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPriceRangeModal(false)}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-black font-bold">Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  optionsMenu: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    width: 250,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default ShopScreen;