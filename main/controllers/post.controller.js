import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { Post } from "../models/post.model.js";
import { Route } from "../models/route.model.js";
import { User } from "../models/user.model.js";

const createPost = asyncHandler(async (req, res) => {
    const { src, dest, via, tripDate, tripTime, transportation, notes, visibleTo } = req.body;
    const userId = req.user?._id;

    if (!src || !dest || !via || !tripDate || !tripTime || !transportation) {
        throw new APIError(400, "All fields are required.");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new APIError(404, "User not found.");
    }

    const post = await Post.create({
        userId,
        src,
        dest,
        via,
        tripDate,
        tripTime,
        transportation,
        notes,
        visibleTo: visibleTo || user.settings.postVisibility,
    });

    return res.status(201).json(new APIResponse(201, post, "Post created successfully"));
});

const deletePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;

    const post = await Post.findOneAndDelete({ _id: postId, userId });
    if (!post) {
        throw new APIError(404, "Post not found or you do not have permission to delete it.");
    }

    return res.status(200).json(new APIResponse(200, null, "Post deleted successfully"));
});

const getPosts = asyncHandler(async (req, res) => {
    const {
        src,
        dest,
        transportation,
        tripDate,
        tripTime,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortType = "desc",
    } = req.query;
    const userId = req.user?._id;

    if (isNaN(page) || isNaN(limit)) {
        throw new APIError(400, "Invalid page or limit parameters");
    }

    let query = { userId };
    if (src) query.src = new RegExp(`^${src}`, "i");
    if (dest) query.dest = new RegExp(`^${dest}`, "i");
    if (transportation) query.transportation = transportation;
    if (tripDate) query.tripDate = tripDate;
    if (tripTime) query.tripTime = tripTime;

    const options = {
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        limit: parseInt(limit, 10),
        sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
    };

    const [posts, totalPosts] = await Promise.all([
        Post.find(query, null, options)
            .populate("userId", "-password -isVerified -settings -refreshToken")
            .select("-createdAt -updatedAt -__v"),
        Post.countDocuments(query),
    ]);

    return res
        .status(200)
        .json(
            new APIResponse(
                200,
                { posts, totalPosts },
                "Posts fetched successfully"
            )
        );
});


export {createPost, deletePost, getPosts};