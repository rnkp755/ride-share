import { Router } from "express";
import { addRoute } from "../controllers/route.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";

const routeRouter = Router();

routeRouter.route("/add").post(verifyAdmin, addRoute);

export default routeRouter;