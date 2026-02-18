import { UserDocument } from "../models/user.model.ts";

declare global {
    namespace Express {
        interface User extends UserDocument {
            _id ?: any;
        }
    }
}