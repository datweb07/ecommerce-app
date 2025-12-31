/*notification.service.js */
import { Expo } from "expo-server-sdk";

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification for order status update
 * @param {string} expoPushToken - User's Expo push token
 * @param {Object} orderData - Order information
 * @param {string} status - New order status (shipped/delivered)
 * @returns {Promise<Object>} - Notification send result
 */
export async function sendOrderStatusNotification(
    expoPushToken,
    orderData,
    status
) {
    try {
        // Validate push token
        if (!Expo.isExpoPushToken(expoPushToken)) {
            console.error(`Invalid Expo push token: ${expoPushToken}`);
            return { success: false, error: "Invalid push token" };
        }

        // Prepare notification content based on status
        const notificationContent = getNotificationContent(status, orderData);

        // Create push notification message
        const message = {
            to: expoPushToken,
            sound: "default",
            title: notificationContent.title,
            body: notificationContent.body,
            data: {
                orderId: orderData._id.toString(),
                status: status,
                screen: "OrderDetail",
            },
            priority: "high",
            channelId: "order-updates",
        };

        // Send notification
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("Error sending push notification chunk:", error);
            }
        }

        // Check for errors in tickets
        const hasErrors = tickets.some(
            (ticket) => ticket.status === "error"
        );

        if (hasErrors) {
            console.error("Some notifications failed to send:", tickets);
            return { success: false, tickets };
        }

        console.log("Push notification sent successfully:", tickets);
        return { success: true, tickets };
    } catch (error) {
        console.error("Error in sendOrderStatusNotification:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get notification title and body based on order status
 * @param {string} status - Order status
 * @param {Object} orderData - Order information
 * @returns {Object} - Notification title and body
 */
function getNotificationContent(status, orderData) {
    const orderId = orderData._id.toString().slice(-8).toUpperCase();

    switch (status) {
        case "shipped":
            return {
                title: "Đơn hàng đang được giao 🚚",
                body: `Đơn hàng #${orderId} đang trên đường giao đến bạn!`,
            };

        case "delivered":
            return {
                title: "Đơn hàng đã giao thành công 🎉",
                body: `Đơn hàng #${orderId} đã được giao thành công. Hãy đánh giá sản phẩm nhé!`,
            };

        default:
            return {
                title: "Cập nhật đơn hàng",
                body: `Đơn hàng #${orderId} đã được cập nhật.`,
            };
    }
}

/**
 * Validate Expo push token format
 * @param {string} token - Push token to validate
 * @returns {boolean} - True if valid
 */
export function isValidExpoPushToken(token) {
    return Expo.isExpoPushToken(token);
}
