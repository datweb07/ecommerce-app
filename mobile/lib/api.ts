import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";
import { useEffect } from "react";

// work in simulator
// const API_URL = "http://192.168.1.11:3000/api/";

// work in physical device
const API_URL = "https://ecommerce-app-nl98.onrender.com/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const useApi = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      const token = await getToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [getToken]);

  return api;
};
