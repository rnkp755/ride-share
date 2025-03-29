import { Router } from "express";
import { addRoute, searchRoutes } from "../controllers/route.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";

const routeRouter = Router();

routeRouter.route("/add").post(verifyAdmin, addRoute);
routeRouter.route("/search").post(verifyJWT, searchRoutes);

export default routeRouter;
