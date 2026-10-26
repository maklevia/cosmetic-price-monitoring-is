import { Request, Response } from "express";
import { UserService } from "@api/modules/user/UserService.js";
import { ValidationError } from "@api/errors/AppError.js";

const userService = new UserService();

export class InternalUserController {
  createUserProfile = async (req: Request, res: Response) => {
    const { id, email, name } = req.body;

    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ValidationError("User ID must be a positive integer");
    }

    if (typeof email !== "string" || !email.includes("@")) {
      throw new ValidationError("Email is invalid");
    }

    if (name !== undefined && name !== null && typeof name !== "string") {
      throw new ValidationError("Name must be a string or null");
    }

    const normalizedName =
      typeof name === "string" && name.trim() !== "" ? name.trim() : null;

    const result = await userService.createUserProfile(
      userId,
      email.trim().toLowerCase(),
      normalizedName,
    );

    res.status(result.created ? 201 : 200).json({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });
  };
}
