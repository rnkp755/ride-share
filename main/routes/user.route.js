import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeUserPassword,
    resetPassword,
    updateProfile,
    getUserProfile,
    getUserProfileForAdmin,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(registerUser);
userRouter.route("/login").post(loginUser);
userRouter.route("/logout").post(verifyJWT, logoutUser);
userRouter.route("/refresh-access-token").post(refreshAccessToken);
userRouter.route("/change-password").post(verifyJWT, changeUserPassword);
userRouter.route("/reset-password").post(resetPassword);
userRouter.route("/update").patch(verifyJWT, updateProfile);
userRouter.route("/").get(verifyJWT, getUserProfile);
userRouter.route("/getProfile").get(verifyAdmin, getUserProfileForAdmin);

export default userRouter;
