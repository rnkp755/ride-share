import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const postSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
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
        via: {
            type: String,
            required: true,
        },
        tripDate: {
            type: String,
            required: true,
        },
        tripTime: {
            type: String,
            required: true,
        },
        transportation: {
            type: String,
            enum: ["Bike", "Auto", "Car", "Bus", "Unknown"],
            required: true,
        },
        notes: {
            type: String,
        },
        visibleTo: {
            type: String,
            enum: ["all", "female-only", "employee-only"],
            default: "all",
        },
    },
    {timestamps: true}
)

postSchema.plugin(mongooseAggregatePaginate);
export const Post = mongoose.model("Post", postSchema);