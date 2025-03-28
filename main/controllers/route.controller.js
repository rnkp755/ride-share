import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { Route } from "../models/route.model.js";

const handleAddViaInRoute = async(src, dest, via) => {
    const route = await Route.findOne({
        $and: [
            { src },
            { dest },
        ], 
    });
    if (!route) {
        const newRoute = await Route.create({
            src,
            dest,
            via,
        });
        return newRoute;
    }
    for(const i of via) {
        if (!route.via.includes(i)) {
            route.via.push(i.trim());
        }
    }
    await route.save({ runvalidators: true });
    const updatedRoute = await Route.findById(route._id);
    return updatedRoute;
}

const addRoute = asyncHandler(async (req, res) => {
    const { src, dest, via } = req.body;

    if (!src || !dest || !Array.isArray(via)) {
        throw new APIError(400, "All fields are required and via must be an array.");
    }

    const newRoute = await handleAddViaInRoute(src.trim(), dest.trim(), via);
    res.status(201).json(new APIResponse(201, newRoute, "Route added successfully"));
});

export {addRoute};