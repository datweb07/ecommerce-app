import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";

export const inngest = new Inngest({ id: "ecommerce-app" });
const syncUser = inngest.createFunction(
  { id: "sync-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectDB();
    const { id, email_addresses, first_name, last_name, image_url, profile_image_url } =
      event.data;
    const newUser = {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}` || "User",
      imageUrl: profile_image_url || image_url || "",
      addresses: [],
      wishlist: [],
    };
    await User.create(newUser);
  }
);

const updateUser = inngest.createFunction(
  { id: "update-user" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    await connectDB();
    const { id, email_addresses, first_name, last_name, image_url, profile_image_url } =
      event.data;

    const updatedData = {
      name: `${first_name || ""} ${last_name || ""}`.trim() || "User",
      imageUrl: profile_image_url || image_url || "",
    };

    await User.findOneAndUpdate(
      { clerkId: id },
      updatedData,
      { new: true }
    );
  }
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete-user-from-db" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();
    const { id } = event.data;
    await User.deleteOne({ clerkId: id });
  }
);
export const functions = [syncUser, updateUser, deleteUserFromDB];
