import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { getFirebaseMessaging } from "../utils/firebase.js";

const NOTIFICATION_REASONS = ["message", "promotion", "alert"];

/**
 * Triggers a new message notification to a user via Firebase Cloud Messaging
 *
 * @param {string} toUserId - The user ID of the recipient
 * @param {string} fromUserId - The user ID of the sender
 * @param {string} title - The title of the notification
 * @param {string} body - The body content of the notification
 * @param {string} senderName - The name of the sender
 * @param {string} senderAvatar - The avatar URL of the sender
 * @param {string} fcmToken - The FCM token for the recipient user
 * @returns {Promise<void>}
 */
const triggerNewMessageNotification = async (
	toUserId,
	fromUserId,
	title,
	body,
	senderName,
	senderAvatar,
	fcmToken
) => {
	console.log(`Sending notification to ${toUserId} (${fcmToken})`);
	try {
		// Check if FCM token is provided
		if (!fcmToken) {
			console.log(`No FCM token provided for user ${toUserId}`);
			return;
		}
		// For React Native/Expo specifically, we want to use proper navigation params
		// instead of using click_action
		const message = {
			token: fcmToken,
			notification: {
				title: title,
				body: body,
				imageUrl: senderAvatar || undefined,
			},
			data: {
				reason: `New Message from ${senderName.split(" ")[0]}`,
				fromUserId: fromUserId.toString(),
				toUserId: toUserId.toString(),
				senderName: senderName,
				senderAvatar: senderAvatar || "",
				// For Expo, we use route names and params
				route: `messages/${fromUserId}`,
				additionalParams: JSON.stringify({
					userId: fromUserId.toString(),
					name: senderName,
					avatar: senderAvatar || "",
				}),
				timestamp: Date.now().toString(),
			},
			android: {
				priority: "high",
				notification: {
					sound: "default",
					channelId: "messages", // You should create this channel in your app
				},
			},
			apns: {
				payload: {
					aps: {
						sound: "default",
						badge: 1,
						contentAvailable: true,
					},
				},
				fcmOptions: {
					imageUrl: senderAvatar || undefined,
				},
			},
		};

		// Send the message
		const messaging = getFirebaseMessaging();
		const response = await messaging.send(message);

		console.log("Successfully sent notification:", response);
		return response;
	} catch (error) {
		console.error("Error sending notification:", error);
		throw error;
	}
};

const sendNotification = asyncHandler(async (req, res) => {
	const { toUserId, title, body } = req.body;
	const fromUserId = req.user?._id;
	const { reason } = req.params;

	if (!toUserId || !title || !body) {
		throw new APIError(400, "All fields are required.");
	}

	if (!fromUserId || !reason || !NOTIFICATION_REASONS.includes(reason)) {
		throw new APIError(401, "Unauthorized or invalid request.");
	}

	const fromUser = await User.findById(fromUserId).select("name avatar");
	const toUser = await User.findById(toUserId).select("fcmToken");

	if (!fromUser || !toUser) {
		throw new APIError(404, "User not found");
	}
	try {
		if (reason === "message") {
			await triggerNewMessageNotification(
				toUserId,
				fromUserId,
				title,
				body,
				fromUser.name,
				fromUser.avatar,
				toUser.fcmToken
			);
		}

		return res
			.status(200)
			.json(
				new APIResponse(200, {}, "Notification triggered successfully.")
			);
	} catch (error) {
		throw new APIError(500, "Failed to send notification yr", error);
	}
});

export { sendNotification };
