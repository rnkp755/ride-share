import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { Post } from "../models/post.model.js";
import { Route } from "../models/route.model.js";
import { User } from "../models/user.model.js";
import Fuse from "fuse.js";

const hashEmail = (email) => {
	// Check if the email ends with '@cumail.in'
	if (email.endsWith("@cumail.in")) {
		const localPart = email.split("@")[0]; // Extract the part before '@'
		const localParts = localPart.split("."); // Split by dot to get the first part
		const hashedLocalPart =
			localParts[0] +
			"." +
			"*".repeat(localParts.slice(1).join(".").length); // Replace all characters after the first part with '*'
		return `${hashedLocalPart}@cumail.in`;
	}

	// Check if the email ends with '@cuchd.in'
	if (email.endsWith("@cuchd.in")) {
		const localPart = email.split("@")[0]; // Extract the part before '@'
		const hashedLocalPart =
			localPart.slice(0, 5) + "*".repeat(localPart.length - 5); // Keep first 5 characters, replace the rest with '*'
		return `${hashedLocalPart}@cuchd.in`;
	}

	return "";
};

const createPost = asyncHandler(async (req, res) => {
	const {
		src,
		dest,
		via,
		tripDate,
		tripTime,
		transportation,
		notes,
		visibleTo,
	} = req.body;
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

	return res
		.status(201)
		.json(new APIResponse(201, post, "Post created successfully"));
});

const deletePost = asyncHandler(async (req, res) => {
	const { postId } = req.params;
	const userId = req.user?._id;

	const post = await Post.findOneAndDelete({ _id: postId, userId });
	if (!post) {
		throw new APIError(
			404,
			"Post not found or you do not have permission to delete it."
		);
	}

	return res
		.status(200)
		.json(new APIResponse(200, null, "Post deleted successfully"));
});

const getPosts = asyncHandler(async (req, res) => {
	const {
		postedBy,
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

	const user = await User.findById(userId);
	if (!user) {
		throw new APIError(404, "User not found.");
	}

	let allowedVisibleTo = ["all"];
	if (user.role === "employee") allowedVisibleTo.push("employee-only");
	if (user.gender === "female") allowedVisibleTo.push("female-only");

	let query = { visibleTo: { $in: allowedVisibleTo } };
	if (postedBy) query.userId = postedBy;
	else query.userId = { $ne: userId }; // Exclude user's own posts
	if (transportation) query.transportation = transportation;
	if (tripDate) query.tripDate = tripDate;
	if (tripTime) query.tripTime = tripTime;

	const options = {
		skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
		limit: parseInt(limit, 10),
		sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
	};

	// Step 1: Fetch all posts based on the basic query
	let posts = await Post.find(query, null, options)
		.populate({
			path: "userId",
			select: "-password -isVerified -settings -refreshToken -createdAt -updatedAt -__v",
			options: { lean: true }, // Use lean for faster plain object retrieval
		})
		.select("-updatedAt -__v")
		.lean() // Ensure posts are plain objects for easier manipulation
		.exec();

	// Step 2: Apply Fuse.js for fuzzy search on `src` and `dest` fields
	const fuseOptions = {
		includeScore: true,
		keys: ["src", "dest"],
	};

	const fuse = new Fuse(posts, fuseOptions);

	// Fuzzy search on 'src' and 'dest' if the user has provided values
	if (src) {
		// Filter posts based on fuzzy matching on 'src'
		posts = fuse.search(src).map((result) => result.item);
	}

	if (dest) {
		// Filter posts based on fuzzy matching on 'dest'
		posts = fuse.search(dest).map((result) => result.item);
	}

	// Step 3: Calculate the total count of the filtered posts
	const totalPosts = posts.length;
	console.log("Total posts after fuzzy filtering:", totalPosts);

	// Step 4: Paginate the results after fuzzy filtering
	const paginatedPosts = posts.slice(
		options.skip,
		options.skip + options.limit
	);

	// Hash emails directly in the populated documents
	paginatedPosts.forEach((post) => {
		if (post.userId && post.userId.email) {
			post.userId.email = hashEmail(post.userId.email);
		}
	});

	// Return the paginated and fuzzy-matched results
	return res
		.status(200)
		.json(
			new APIResponse(
				200,
				{ posts: paginatedPosts, totalPosts },
				"Posts fetched successfully"
			)
		);
});

export { createPost, deletePost, getPosts, hashEmail };
