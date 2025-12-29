import { useApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ProfileData {
    bio: string;
    phoneNumber: string;
    name: string;
    email: string;
    imageUrl: string;
}

interface UpdateProfileData {
    bio?: string;
    phoneNumber?: string;
}

export function useProfile() {
    const api = useApi();
    const queryClient = useQueryClient();

    // Fetch profile
    const {
        data: profile,
        isLoading,
        isError,
        error,
    } = useQuery<ProfileData>({
        queryKey: ["profile"],
        queryFn: async () => {
            const { data } = await api.get("/users/profile");
            return data.profile;
        },
    });

    // Update profile
    const updateProfileMutation = useMutation({
        mutationFn: async (profileData: UpdateProfileData) => {
            const { data } = await api.put("/users/profile", profileData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["profile"] });
        },
    });

    return {
        profile,
        isLoading,
        isError,
        error,
        updateProfile: updateProfileMutation.mutateAsync,
        isUpdating: updateProfileMutation.isPending,
    };
}
