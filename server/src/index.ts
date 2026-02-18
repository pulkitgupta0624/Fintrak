import "dotenv/config"
import './config/passport.config.ts'
import express, { NextFunction, Response, Request } from 'express'
import { Env } from "./config/env.config.js"
import cors from 'cors'
import passport from "passport"
import { HTTPSTATUS } from "./config/http.config.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { BadRequestException } from "./utils/app-error.js";
import { asyncHandler } from "./middlewares/asyncHandler.middleware.js";
import connectDatabase from "./config/database.config.js";
import authRoutes from "./routes/auth.route.ts";
import userRoutes from "./routes/user.route.ts";
import { passportAuthenticateJwt } from "./config/passport.config.ts"
import transactionRoutes from "./routes/transaction.route.ts"
import reportRoutes from "./routes/report.route.ts"
import analyticsRoutes from "./routes/analytics.route.ts"
import { initializeCrons } from "./crons/index.ts"
import { getDateRange } from "./utils/date.ts"
import billingRoutes from "./routes/billing.routes.ts"
import webhookRoutes from "./routes/webhook.route.ts"

const app = express();
const BASE_PATH = Env.BASE_PATH;

app.use("/webhook",webhookRoutes)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(passport.initialize())

app.use(
    cors({
        origin: Env.FRONTEND_ORIGIN,
        credentials: true,
    })
)

app.get(
    "/",
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        throw new BadRequestException("This is a test error");
        res.status(HTTPSTATUS.OK).json({
            message: "Hello Subcribe to the channel",
        });
    })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes);
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes);
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes);
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes);
app.use(`${BASE_PATH}/billing`, passportAuthenticateJwt, billingRoutes);

app.use(errorHandler)

app.listen(Env.PORT, async () => {
    await connectDatabase();

      if (Env.NODE_ENV === "development") {
        await initializeCrons();
      }

    console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
});
