import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/express";

export async function getProfile(req, res) {
  try {
    const user = req.user;

    res.status(200).json({
      profile: {
        bio: user.bio || "",
        userName: user.userName || "",
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      },
    });
  } catch (error) {
    console.error("Error in getProfile controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const { bio, userName } = req.body;
    const user = req.user;

    // Validate bio length
    if (bio && bio.length > 500) {
      return res.status(400).json({
        error: "Bio must be 500 characters or less",
      });
    }

    // Validate userName uniqueness if provided
    if (userName && userName !== user.userName) {
      const existingUser = await User.findOne({ userName });
      if (existingUser) {
        return res.status(400).json({
          error: "Username already taken",
        });
      }
    }

    // Update fields
    if (bio !== undefined) {
      user.bio = bio;
    }
    if (userName !== undefined) {
      user.userName = userName;
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        bio: user.bio,
        userName: user.userName,
      },
    });
  } catch (error) {
    console.error("Error in updateProfile controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function syncImageFromClerk(req, res) {
  try {
    const user = req.user;

    // Get fresh user data from Clerk
    const clerkUser = await clerkClient.users.getUser(user.clerkId);

    // Update imageUrl from Clerk
    const newImageUrl = clerkUser.profileImageUrl || clerkUser.imageUrl || "";
    user.imageUrl = newImageUrl;
    user.name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";

    await user.save();

    res.status(200).json({
      message: "Image synced successfully from Clerk",
      imageUrl: user.imageUrl,
      name: user.name,
    });
  } catch (error) {
    console.error("Error in syncImageFromClerk controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function registerPushToken(req, res) {
  try {
    const { expoPushToken } = req.body;
    const user = req.user;

    if (!expoPushToken) {
      return res.status(400).json({ error: "Push token is required" });
    }

    // Validate Expo push token format
    const { isValidExpoPushToken } = await import("../services/notification.service.js");
    if (!isValidExpoPushToken(expoPushToken)) {
      return res.status(400).json({ error: "Invalid push token format" });
    }

    // Save token to user
    user.expoPushToken = expoPushToken;
    await user.save();

    res.status(200).json({
      message: "Push token registered successfully",
      expoPushToken: user.expoPushToken,
    });
  } catch (error) {
    console.error("Error in registerPushToken controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addAddress(req, res) {
  try {
    const {
      label,
      fullName,
      streetAddress,
      city,
      state,
      zipCode,
      phoneNumber,
      isDefault,
    } = req.body;

    const user = req.user;

    if (!fullName || !streetAddress || !city || !state || !zipCode) {
      return res.status(400).json({ error: "Missing required address fields" });
    }

    // if this is as a default, unset all other defaults
    if (isDefault) {
      user.addresses.forEach((add) => {
        add.isDefault = false;
      });
    }

    user.addresses.push({
      label,
      fullName,
      streetAddress,
      city,
      state,
      zipCode,
      phoneNumber,
      isDefault: isDefault || false,
    });

    await user.save();

    res.status(201).json({
      message: "Address added successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Error in addAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
export async function getAddress(req, res) {
  try {
    const user = req.user;

    res.status(200).json({ addresses: user.addresses });
  } catch (error) {
    console.error("Error in getAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
export async function updateAddress(req, res) {
  try {
    const {
      label,
      fullName,
      streetAddress,
      city,
      state,
      zipCode,
      phoneNumber,
      isDefault,
    } = req.body;

    const { addressId } = req.params;
    const user = req.user;
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        error: "Address not found",
      });
    }

    // if this is as a default, unset all other defaults
    if (isDefault) {
      user.addresses.forEach((add) => {
        add.isDefault = false;
      });
    }

    address.label = label || address.label;
    address.fullName = fullName || address.fullName;
    address.streetAddress = streetAddress || address.streetAddress;
    address.city = city || address.city;
    address.state = state || address.state;
    address.zipCode = zipCode || address.zipCode;
    address.phoneNumber = phoneNumber || address.phoneNumber;
    address.isDefault = isDefault !== undefined ? isDefault : address.isDefault;

    await user.save();

    res.status(200).json({
      message: "Address updated successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Error in updateAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
export async function deleteAddress(req, res) {
  try {
    const { addressId } = req.params;
    const user = req.user;

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    address.deleteOne();
    await user.save();

    res.status(200).json({
      message: "Address deleted successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Error in deleteAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addToWishlist(req, res) {
  try {
    const { productId } = req.body;
    const user = req.user;

    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();

    res
      .status(200)
      .json({ message: "Product added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error("Error in addToWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
export async function removeFromWishlist(req, res) {
  try {
    const { productId } = req.params;
    const user = req.user;

    if (!user.wishlist.includes(productId)) {
      return res.status(400).json({ error: "Product not found in wishlist" });
    }

    user.wishlist.pull(productId);
    await user.save();

    res.status(200).json({
      message: "Product removed from wishlist",
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error("Error in removeFromWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
export async function getWishlist(req, res) {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error) {
    console.error("Error in getWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
