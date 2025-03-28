import mongoose, { Schema } from "mongoose";

const routeSchema = new Schema(
    {
        src: {
            type: String,
            required: true,
            index: true,
        },
        dest: {
            type: String,
            required: true,
            index: true,
        },
        via: [
            {
                type: String,
                required: true,
            },
        ],
    },
    { timestamps: true }
);

routeSchema.index({ src: 1, dest: 1 }, { unique: true });
export const Route = mongoose.model("Route", routeSchema);
