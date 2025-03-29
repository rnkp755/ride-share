import { Router } from "express";
import { createPost, deletePost, getPosts } from "../controllers/post.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const postRouter = Router();

postRouter.route("/create").post(verifyJWT, createPost);
postRouter.route("/delete/:postId").delete(verifyJWT, deletePost);
postRouter.route("/").get(verifyJWT, getPosts);

export default postRouter;