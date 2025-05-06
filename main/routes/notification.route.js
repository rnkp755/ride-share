import { Router } from "express";
import { sendNotification } from "../controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const notificationRouter = Router();

// reason: ["message", "promotion", "alert"]

notificationRouter.route("/send/:reason").post(verifyJWT, sendNotification);

export default notificationRouter;
