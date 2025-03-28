import asyncHandler from "../utils/asyncHandler.js";
import { OTP } from "../models/otp.model.js";
import { User } from "../models/user.model.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { sendOTPMail } from "../utils/sendMail.js";
import { generateAccessAndRefreshTokens } from "./user.controller.js";

// Generate and send OTP
const sendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const { reason } = req.params;
    if (!email) throw new APIError(400, "Email is required");
    if (!reason) throw new APIError(400, "Invalid Route. Reason is required");

    const user = await User.findOne({ email });
    if (!user) {
        throw new APIError(400, "User doesn't exist");
    }

    const otp = crypto.randomInt(1000, 9999).toString();

    await OTP.create({
        email,
        otp,
        reason,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    sendOTPMail(email, otp);

    return res
        .status(200)
        .json(new APIResponse(200, {}, "OTP sent successfully"));
});

// Verify OTP and proceed
const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const { reason } = req.params;

    if (!email || !otp) throw new APIError(400, "Email & OTP is required");
    if (!reason) throw new APIError(400, "Invalid Route. Reason is required");

    const record = await OTP.findOne({ email }).sort({ createdAt: -1 });
    if (
        !record ||
        record.otp !== otp ||
        record.expiresAt < new Date() ||
        record.reason !== reason
    ) {
        throw new APIError(400, "Invalid or expired OTP");
    }

    if (reason === "register") {
        const { loggedInUser, accessToken, refreshToken } =
            await handleUserRegister(email);

        await OTP.deleteMany({ email, reason });

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
                    { loggedInUser },
                    "OTP verified, Wishing you nice experience with us"
                )
            );
    } else if (reason === "reset-password") {
        if (!newPassword) {
            throw new APIError(400, "New password is required");
        }
        const hashedPassword = await bcrypt.hash(newPassword, 8);
        const user = await User.findOneAndUpdate(
            { email },
            { password: hashedPassword },
            { new: true }
        ).select("-password -__v -createdAt -updatedAt -refreshToken");
        if (!user) {
            throw new APIError(400, "User doesn't exist");
        }
        await OTP.deleteMany({ email, reason });
        return res
            .status(200)
            .json(
                new APIResponse(
                    200,
                    user,
                    "Password Updated successfully. Please login again"
                )
            );
    }
});

const handleUserRegister = async (email) => {
    const user = await User.findOneAndUpdate(
        { email },
        { isVerified: true },
        { new: true }
    );
    if (!user) {
        throw new APIError(400, "User doesn't exist");
    }
    // Login the user as well now, if everything is well
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );
    const loggedInUser = await User.findByIdAndUpdate(
        {
            _id: user._id,
        },
        {
            refreshToken,
        },
        {
            new: true,
        }
    ).select(
        "-password -__v -createdAt -updatedAt -refreshToken -allowPasswordReset"
    );
    if (!loggedInUser) {
        throw new APIError(400, "Something went wrong while logging in");
    }
    return { loggedInUser, accessToken, refreshToken };
};

export { sendOTP, verifyOTP };
