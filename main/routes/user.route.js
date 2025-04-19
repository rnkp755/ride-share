import { Router } from "express";
import {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changeUserPassword,
	updateAvatar,
	updateUserSettings,
	getUserProfile,
	getUserPublicProfile,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import multer from "multer";

const userRouter = Router();
const upload = multer({ storage: multer.diskStorage({}) });

userRouter.route("/register").post(registerUser);
userRouter.route("/login").post(loginUser);
userRouter.route("/logout").post(verifyJWT, logoutUser);
userRouter.route("/refresh-access-token").post(refreshAccessToken);
userRouter.route("/change-password").post(verifyJWT, changeUserPassword);
userRouter
	.route("/update-avatar")
	.patch(verifyJWT, upload.single("avatar"), updateAvatar);
userRouter.route("/update-settings").patch(verifyJWT, updateUserSettings);
userRouter.route("/me").get(verifyJWT, getUserProfile);
userRouter.route("/:id").get(verifyJWT, getUserPublicProfile);

export default userRouter;
