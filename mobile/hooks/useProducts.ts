import { useApi } from "@/lib/api";
import { Product } from "@/types";
import { useQuery } from "@tanstack/react-query";

const useProducts = () => {
  const api = useApi();

  const result = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        console.log("Fetching products...");
        const response = await api.get<Product[]>("/products");
        console.log("API Response:", response);
        console.log("Response data:", response.data);
        return response.data;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
    },
  });

  console.log("Query result:", {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
  });

  return result;
};

export default useProducts;
