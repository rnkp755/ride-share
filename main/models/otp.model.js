import mongoose, { Schema } from "mongoose";

const otpSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            index: true,
        },
        otp: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            required: true,
            enum: ["register", "reset-password"],
        },
        expiresAt: {
            type: Date,
            required: true,
            default: Date.now + 5 * 60 * 1000,
        },
    },
    { timestamps: true }
);

export const OTP = mongoose.model("OTP", otpSchema);
