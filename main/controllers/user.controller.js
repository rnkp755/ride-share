import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { getNameFromOutlook } from "./outlook.controller.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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

    const existedUser = await User.findOne({ email });
    if (existedUser && existedUser.isVerified) {
        throw new APIError(400, "User already exists");
    }

    const name =
        (await getNameFromOutlook(email.trim().toLowerCase())) ||
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
        "-password -__v -createdAt -updatedAt"
    );
    if (!user) throw new APIError(404, "User doesn't exist");

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
    console.log("Logout ", req.user._id);
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
        const { newAccessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);
        console.log("New Access Token", newAccessToken);

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new APIResponse(
                    200,
                    {
                        email: user.email,
                        name: user.name,
                        avatar: user.avatar,
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken,
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

const resetPassword = asyncHandler(async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email) {
        throw new APIError(400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new APIError(400, "User doesn't exist");
    }
    if (
        !user.allowPasswordReset ||
        new Date() > new Date(user.updatedAt.getTime() + 5 * 60 * 1000)
    ) {
        throw new APIError(
            400,
            "Password reset is not allowed. Reset Session maybe expired."
        );
    }

    user.password = newPassword;
    user.allowPasswordReset = false;
    await user.save({ validateBeforeSave: true });

    return res
        .status(200)
        .json(new APIResponse(200, {}, "Password Updated Successfully"));
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
        "-password -refreshToken -__v -createdAt -updatedAt -allowPasswordReset"
    );
    if (!user) {
        throw new APIError(404, "User not found");
    }
    return res
        .status(200)
        .json(new APIResponse(200, user, "User Profile fetched successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatar = req.file?.path;
    if (!avatar) throw new APIError(400, "Please provide an avatar");

    const response = await uploadOnCloudinary(file.path);
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
    ).select(
        "-password -refreshToken -__v -createdAt -updatedAt -allowPasswordReset"
    );
    if (!user) {
        throw new APIError(404, "User not found");
    }

    return res
        .status(200)
        .json(new APIResponse(200, user, "User Avatar updated successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    resetPassword,
    changeUserPassword,
    getUserProfile,
    updateAvatar,
    generateAccessAndRefreshTokens,
};
