import { Router } from "express";
import { getName } from "../controllers/outlook.controller.js";

const outlookRouter = Router();

outlookRouter.route("/").post(getName);

export default outlookRouter;
