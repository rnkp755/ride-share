import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const userSchema = new Schema(
	{
		name: {
			type: String,
			trim: true,
			uppercase: true,
			required: true,
		},
		email: {
			type: String,
			required: true,
			minlength: 10,
			maxlength: 50,
			unique: true,
			lowercase: true,
			trim: true,
			match: [/^[^\s@]+@(cuchd\.in|cumail\.in)$/, "Invalid email"],
		},
		gender: {
			type: String,
			enum: ["male", "female", "other"],
		},
		avatar: {
			type: String,
			required: true,
		},
		password: {
			type: String,
			required: true,
			minLength: [8, "Password must be at least 8 characters long"],
			maxLength: [16, "Password must be at most 16 characters long"],
		},
		role: {
			type: String,
			enum: ["student", "employee", "admin"],
			default: "student",
		},
		refreshToken: {
			type: String,
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		fcmToken: {
			type: String,
			default: null,
		},
		settings: {
			type: new Schema(
				{
					postVisibility: {
						type: String,
						enum: ["all", "female-only", "employee-only"],
						default: "all",
					},
				},
				{ _id: false } // Prevents _id creation for the subdocument
			),
			default: { postVisibility: "all" },
		},
	},
	{ timestamps: true }
);

userSchema.pre("save", async function (next) {
	if (this.isModified("password")) {
		this.password = await bcrypt.hash(this.password, 8);
	}
	next();
});

userSchema.methods.isPasswordcorrect = async function (password) {
	return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = async function () {
	return jwt.sign(
		{
			_id: this._id,
			email: this.email,
		},
		process.env.ACCESS_TOKEN_SECRET,
		{
			expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
		}
	);
};

userSchema.methods.generateRefreshToken = async function () {
	return jwt.sign(
		{
			_id: this._id,
		},
		process.env.REFRESH_TOKEN_SECRET,
		{
			expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
		}
	);
};
export const User = mongoose.model("User", userSchema);
