import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({
	path: "./.env",
});

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SCERET,
});

const uploadOnCloudinary = async (localFilePath) => {
	try {
		if (!localFilePath) return null;
		const response = await cloudinary.uploader.upload(localFilePath, {
			folder: "insuline-dev",
			resource_type: "auto",
		});
		console.log(
			"File has been  successfully uploaded to Cloudinary",
			response.url
		);
		fs.unlinkSync(localFilePath);
		return response;
	} catch (error) {
		console.log("Error while uploading file to Cloudinary", error);
		fs.unlinkSync(localFilePath);
		return null;
	}
};

export { uploadOnCloudinary };
