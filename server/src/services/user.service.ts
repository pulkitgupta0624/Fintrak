import UserModel from "../models/user.model.ts"
import { UpdateUserType } from "../validators/user.validator.ts"
import { NotFoundException } from "../utils/app-error.ts"

export const findByIdUserService = async (userId: string) => {
    const user = await UserModel.findById(userId)
    return user?.omitPassword()
}

export const updateUserService = async (
    userId: string,
    body: UpdateUserType,
    profilePic?: Express.Multer.File
) => {
    const user = await UserModel.findById(userId)
    if (!user) throw new Error("User not found")

    if (profilePic) {
        user.profilePicture = profilePic.path
    }

    user.set({
        name: body.name
    })

    await user.save()
    
    return user
}