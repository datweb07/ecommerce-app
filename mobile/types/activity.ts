// types/activity.ts
export type ActivityType = "login" | "logout" | "password_change" | "profile_update";
export type ActivityStatus = "success" | "failed" | "suspicious";

export interface Activity {
    id: string;
    type: ActivityType;
    device: string;
    browser: string;
    location: string;
    time: string;
    status: ActivityStatus;
}