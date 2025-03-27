import mongoose, { Schema } from "mongoose";

const keySchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

export const Key = mongoose.model("Key", keySchema);