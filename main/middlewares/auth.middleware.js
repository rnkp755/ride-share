import { User } from "../models/user.model.js";
import { APIError } from "../utils/APIError.js";
import jwt from "jsonwebtoken";

export const verifyJWT = async (req, _, next) => {
    try {
        const accessToken =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");

        if (accessToken === undefined || accessToken.trim() === "")
            throw new APIError(401, "Couldn't find Accesstoken");

        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        );

        if (!decodedToken) throw new APIError(401, "Invalid Access Token");

        const user = await User.findById(decodedToken._id).select(
            "-password -refreshToken -__v -createdAt -updatedAt"
        );

        if (!user) throw new APIError(401, "Invalid Access Token");

        req.user = user;
        next();
    } catch (error) {
        throw new APIError(401, "Couldn't Validate AccessToken");
    }
};
