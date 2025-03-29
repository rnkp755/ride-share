import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectToMongo from "./db/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(
    cors({
        origin: "*",
        Credentials: true,
    })
);
app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    })
);
app.use(express.json());
app.use(cookieParser());

// Importing routes
import outlookRouter from "./routes/outlook.route.js";
import userRouter from "./routes/user.route.js";
import otpRouter from "./routes/otp.route.js";
import routeRouter from "./routes/route.route.js";
import postRouter from "./routes/post.route.js";
// Using routes
app.use("/api/v1/outlook", outlookRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/otp", otpRouter);
app.use("/api/v1/route", routeRouter);
app.use("/api/v1/post", postRouter);

connectToMongo()
    .then(() => {
        app.on("error", (error) => {
            console.log("MongoDB Connection Failed !!");
            throw error;
        });
        app.listen(process.env.PORT || 8000, () => {
            console.log(
                `Server is listening on PORT ${process.env.PORT || 8000}`
            );
        });
    })
    .catch((error) => {
        console.log("MongoDB Connection Failed !!");
    });
