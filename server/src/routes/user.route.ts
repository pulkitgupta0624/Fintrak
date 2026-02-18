import { Router } from "express";
import { 
    getCurrentUserController, 
    updateUserController 
} from "../controllers/user.controller.ts";

const userRoutes = Router();

userRoutes.get("/current-user", getCurrentUserController);
// userRoutes.put(
//     "/update",
//     upload.single("profilePic"),
//     updateUserController
// )

export default userRoutes