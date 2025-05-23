import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { getNameFromOutlook } from "./outlook.controller.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { hashEmail } from "./post.controller.js";

const generateAccessAndRefreshTokens = async (userId) => {
	try {
		const user = await User.findById(userId);
		const accessToken = await user.generateAccessToken();
		const refreshToken = await user.generateRefreshToken();

		user.refreshToken = refreshToken;
		await user.save({ validateBeforeSave: false });

		return { accessToken, refreshToken };
	} catch (error) {
		throw new APIError(500, "Something went wrong while generating Tokens");
	}
};

const getTempName = (email) => {
	const atIndex = email.indexOf("@");
	const dotIndex = email.indexOf(".");

	const splitIndex =
		atIndex !== -1 && (dotIndex === -1 || atIndex < dotIndex)
			? atIndex
			: dotIndex;

	if (splitIndex !== -1) {
		return email.slice(0, splitIndex);
	}

	return email;
};

const registerUser = asyncHandler(async (req, res) => {
	const { email, gender, password } = req.body;
	if (
		[email, gender, password].includes(undefined) ||
		[email, gender, password].some((field) => field.trim() === "")
	) {
		throw new APIError(400, "Please provide all the required fields");
	}
	if (
		password.length < 8 ||
		!/\d/.test(password) ||
		!/[a-zA-Z]/.test(password) ||
		!/[!@#$%^&*]/.test(password)
	) {
		throw new APIError(
			400,
			"Password must be between 8 to 16 characters and include at least one letter, one number, and one special character"
		);
	}

	const existedUser = await User.findOne({ email });
	if (existedUser && existedUser.isVerified) {
		throw new APIError(400, "User already exists");
	}

	const name =
		(await getNameFromOutlook(email.trim().toLowerCase())).name ||
		getTempName(email.trim());
	let user;
	if (existedUser) {
		user = await User.findByIdAndUpdate(
			{
				_id: existedUser._id,
			},
			{
				name,
				email,
				gender,
				avatar: `https://avatar.iran.liara.run/${
					gender === "other"
						? `username?username=${name.replace(/\s+/g, "+")}`
						: gender === "male"
						? "public/boy"
						: "public/girl"
				}`,
				password,
				createdAt: Date.now(),
			},
			{
				new: true,
				runValidators: true,
			}
		);
	} else {
		user = await User.create({
			name,
			email,
			gender,
			avatar: `https://avatar.iran.liara.run/${
				gender === "other"
					? `username?username=${name.replace(/\s+/g, "+")}`
					: gender === "male"
					? "public/boy"
					: "public/girl"
			}`,
			password,
		});
	}

	const newUser = await User.findById(user._id).select(
		"-password -refreshToken -__v -createdAt -updatedAt"
	);

	if (!newUser)
		throw new APIError(500, "Something went wrong while creating user");

	return res
		.status(201)
		.json(new APIResponse(201, newUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
	const { email, password } = req.body;

	if (!email && !password) {
		throw new APIError(400, "Email or username is required");
	}

	if (password === undefined || password === "") {
		throw new APIError(400, "Password is required");
	}

	const user = await User.findOne({ email }).select(
		"-__v -createdAt -updatedAt"
	);
	if (!user || !user.isVerified)
		throw new APIError(404, "User doesn't exist or not verified");

	const isPasswordValid = await user.isPasswordcorrect(password);

	if (!isPasswordValid) throw new APIError(401, "Invalid User Credentials");

	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	user.refreshToken = refreshToken;

	const options = {
		httpOnly: true,
		secure: true,
	};

	return res
		.status(200)
		.cookie("accessToken", accessToken, options)
		.cookie("refreshToken", refreshToken, options)
		.json(
			new APIResponse(
				200,
				{
					user,
				},
				"User logged in successfully"
			)
		);
});

const logoutUser = asyncHandler(async (req, res) => {
	const user = await User.findByIdAndUpdate(
		req.user._id,
		{
			$unset: {
				refreshToken: 1,
			},
		},
		{
			new: true,
		}
	);

	const options = {
		httpOnly: true,
		secure: true,
	};

	return res
		.status(200)
		.clearCookie("accessToken", options)
		.clearCookie("refreshToken", options)
		.json(new APIResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
	const incomingRefreshToken =
		req.cookies.refreshToken || req.body.refreshToken;

	if (!incomingRefreshToken) throw new APIError(401, "Unathorized Access");

	const decodedToken = jwt.verify(
		incomingRefreshToken,
		process.env.REFRESH_TOKEN_SECRET
	);

	if (!decodedToken || !decodedToken["_id"])
		throw new APIError(401, "Unathorized Access");

	const user = await User.findById(decodedToken._id);

	if (!user) throw new APIError(401, "Invalid refresh token");

	if (incomingRefreshToken !== user?.refreshToken)
		throw new APIError(401, "Refesh Token Invalid or Expired");

	try {
		const { accessToken, refreshToken } =
			await generateAccessAndRefreshTokens(user._id);

		const options = {
			httpOnly: true,
			secure: true,
		};

		return res
			.status(200)
			.cookie("accessToken", accessToken, options)
			.cookie("refreshToken", refreshToken, options)
			.json(
				new APIResponse(
					200,
					{
						email: user.email,
						name: user.name,
						avatar: user.avatar,
						accessToken: accessToken,
						refreshToken: refreshToken,
					},
					"Session restored Successfully"
				)
			);
	} catch (error) {
		throw new APIError(
			501,
			error?.message || "Error while restarting session"
		);
	}
});

const changeUserPassword = asyncHandler(async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	if (!oldPassword || !newPassword) {
		throw new APIError(400, "Please provide all the required fields");
	}
	if (newPassword.length < 8 || newPassword.length > 16) {
		throw new APIError(
			400,
			"Password length must be between 8 to 16 characters"
		);
	}

	const user = await User.findById(req.user?._id);
	if (!user.isPasswordcorrect(oldPassword))
		throw new APIError(400, "Old Password is incorrect");

	user.password = newPassword;
	await user.save({ validateBeforeSave: true });

	return res
		.status(200)
		.json(new APIResponse(200, {}, "Password Updated Successfully"));
});

const getUserProfile = asyncHandler(async (req, res) => {
	const user = await User.findById(req.user?._id).select(
		"-password -refreshToken -__v -createdAt -updatedAt"
	);
	if (!user) {
		throw new APIError(404, "User not found");
	}
	return res
		.status(200)
		.json(new APIResponse(200, user, "User Profile fetched successfully"));
});

const getUserPublicProfile = asyncHandler(async (req, res) => {
	const user = await User.findById(req.params?.id).select(
		"_id name email gender avatar role tripsPosted"
	);
	if (!user) {
		throw new APIError(404, "User not found");
	}
	if (req.user?._id.toString() !== req.params?.id) {
		user.email = hashEmail(user.email);
	}
	return res
		.status(200)
		.json(
			new APIResponse(
				200,
				user,
				"User Public Profile fetched successfully"
			)
		);
});

const updateAvatar = asyncHandler(async (req, res) => {
	const avatar = req.file?.path;
	if (!avatar) throw new APIError(400, "Please provide an avatar");

	const response = await uploadOnCloudinary(avatar);
	if (!response) {
		throw new APIError(500, "Failed to upload images");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			avatar: response.url,
		},
		{
			new: true,
			runValidators: true,
		}
	).select("-password -refreshToken -__v -createdAt -updatedAt");
	if (!user) {
		throw new APIError(404, "User not found");
	}

	return res
		.status(200)
		.json(new APIResponse(200, user, "User Avatar updated successfully"));
});

const updateUserSettings = asyncHandler(async (req, res) => {
	const { postVisibility } = req.body;
	if (!postVisibility)
		throw new APIError(400, "Please provide all the required fields");

	const user = await User.findById(req.user?._id).select(
		"-password -refreshToken -__v -createdAt -updatedAt"
	);
	if (!user) {
		throw new APIError(404, "User not found");
	}

	if (user.role !== "employee" && postVisibility === "employee-only") {
		throw new APIError(
			400,
			"You are not allowed to set post visibility to employee-only"
		);
	} else if (user.gender !== "female" && postVisibility === "female-only") {
		throw new APIError(
			400,
			"You are not allowed to set post visibility to female-only"
		);
	} else if (user.settings.postVisibility === postVisibility) {
		return res
			.status(200)
			.json(
				new APIResponse(200, user, "User settings updated successfully")
			);
	}

	const updatedUser = await User.findByIdAndUpdate(
		req.user._id,
		{
			settings: {
				postVisibility,
			},
		},
		{
			new: true,
			runValidators: true,
		}
	).select("-password -refreshToken -__v -createdAt -updatedAt");

	if (!user) {
		throw new APIError(404, "Udation failed");
	}

	return res
		.status(200)
		.json(
			new APIResponse(
				200,
				updatedUser,
				"User settings updated successfully"
			)
		);
});

const updateFCMToken = asyncHandler(async (req, res) => {
	console.log("Requet came here");
	const { fcmToken } = req.body;
	if (!fcmToken) throw new APIError(400, "Please provide an FCM token");
	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			fcmToken,
		},
		{
			new: true,
			runValidators: true,
		}
	).select("-password -refreshToken -__v -createdAt -updatedAt");
	if (!user) {
		throw new APIError(404, "User not found");
	}

	return res
		.status(200)
		.json(new APIResponse(200, {}, "FCM token updated successfully"));
});

export {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changeUserPassword,
	getUserProfile,
	getUserPublicProfile,
	updateAvatar,
	updateUserSettings,
	updateFCMToken,
	generateAccessAndRefreshTokens,
};
